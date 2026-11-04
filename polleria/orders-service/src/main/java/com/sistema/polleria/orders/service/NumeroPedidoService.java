package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.ContadorPedido;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.repository.ContadorPedidoRepository;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.util.TelefonoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Asigna el número de pedido que ve el cliente ("tu pedido N.° 3").
 * Cada cliente con cuenta tiene su propia numeración; los invitados se numeran por celular.
 * El ID interno de la orden nunca se muestra al cliente.
 *
 * La asignación se serializa por cliente mediante un bloqueo pesimista sobre la fila del
 * contador. Sin ese bloqueo, dos pedidos simultáneos del mismo cliente leían el mismo
 * MAX(numero_cliente) y recibían el mismo número.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NumeroPedidoService {

    private static final String SIN_TELEFONO = "SIN-TELEFONO";

    private final OrdenRepository ordenRepository;
    private final ContadorPedidoRepository contadorPedidoRepository;

    @Transactional
    public void asignar(Orden orden) {
        if (orden.getNumeroCliente() != null) return;

        String clave = claveDe(orden);

        // Se ejecuta dentro de la transacción del pedido: el bloqueo se mantiene hasta que
        // la orden queda insertada, así el siguiente mozo ya ve el número consumido.
        contadorPedidoRepository.crearSiNoExiste(clave);
        ContadorPedido contador = contadorPedidoRepository.buscarConBloqueo(clave)
                .orElseThrow(() -> new IllegalStateException(
                        "No se pudo obtener el contador de numeración para " + clave));

        // Math.max cubre órdenes anteriores a la existencia del contador.
        int siguiente = Math.max(contador.getUltimo(), ultimoRegistrado(orden)) + 1;
        contador.setUltimo(siguiente);
        contadorPedidoRepository.save(contador);

        orden.setNumeroCliente(siguiente);
    }

    /** Clave de numeración: el cliente con cuenta o el celular normalizado del invitado. */
    private String claveDe(Orden orden) {
        if (orden.getClienteId() != null && orden.getClienteId() > 0) {
            return "C:" + orden.getClienteId();
        }
        String canonico = TelefonoUtil.canonico(orden.getTelefonoCliente());
        return "T:" + (canonico != null ? canonico : SIN_TELEFONO);
    }

    /** Último número ya emitido para ese cliente en la tabla de órdenes. */
    private int ultimoRegistrado(Orden orden) {
        Integer max;
        if (orden.getClienteId() != null && orden.getClienteId() > 0) {
            max = ordenRepository.maxNumeroPorCliente(orden.getClienteId());
        } else {
            List<String> telefonos = TelefonoUtil.variantes(orden.getTelefonoCliente());
            max = telefonos.isEmpty() ? 0 : ordenRepository.maxNumeroPorTelefono(telefonos);
        }
        return max != null ? max : 0;
    }
}
