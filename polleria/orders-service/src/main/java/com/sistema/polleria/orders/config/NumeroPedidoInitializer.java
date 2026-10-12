package com.sistema.polleria.orders.config;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.repository.OrdenRepository;
import com.sistema.polleria.orders.service.NumeroPedidoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Migración: asigna número de pedido por cliente a las órdenes creadas antes de que existiera.
 * Se recorren en orden de creación para que el primer pedido de cada cliente sea el N.° 1.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NumeroPedidoInitializer implements ApplicationRunner {

    private final OrdenRepository ordenRepository;
    private final NumeroPedidoService numeroPedidoService;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Orden> sinNumero = ordenRepository.findByNumeroClienteIsNullOrderByIdAsc();
        if (sinNumero.isEmpty()) return;

        for (Orden orden : sinNumero) {
            numeroPedidoService.asignar(orden);
            ordenRepository.saveAndFlush(orden);
        }
        log.info("Número de pedido por cliente asignado a {} órdenes existentes", sinNumero.size());
    }
}
