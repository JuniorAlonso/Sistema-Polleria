package com.sistema.polleria.orders.service;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.util.TelefonoUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Asigna el número de pedido que ve el cliente ("tu pedido N.° 3").
 * Cada cliente con cuenta tiene su propia numeración; los invitados se numeran por celular.
 * El ID interno de la orden nunca se muestra al cliente.
 */
@Service
@RequiredArgsConstructor
public class NumeroPedidoService {

    private final OrdenRepository ordenRepository;

    public void asignar(Orden orden) {
        if (orden.getNumeroCliente() != null) return;

        int ultimo;
        if (orden.getClienteId() != null && orden.getClienteId() > 0) {
            ultimo = ordenRepository.maxNumeroPorCliente(orden.getClienteId());
        } else {
            List<String> telefonos = TelefonoUtil.variantes(orden.getTelefonoCliente());
            ultimo = telefonos.isEmpty() ? 0 : ordenRepository.maxNumeroPorTelefono(telefonos);
        }
        orden.setNumeroCliente(ultimo + 1);
    }
}
