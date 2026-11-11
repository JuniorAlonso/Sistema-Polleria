package com.sistema.polleria.orders.dto;

import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The POS lists a dine-in comanda only when its table asked for the bill (plan 03, D3.14). The
 * cashier cannot read {@code /mesas}, so the order response carries the table state.
 */
class OrdenResponseMesaEstadoTest {

    private Orden orden(Mesa mesa) {
        return Orden.builder()
                .id(10L)
                .tipo(mesa != null ? OrdenTipo.SALON : OrdenTipo.DELIVERY)
                .estado(OrdenEstado.LISTO)
                .total(BigDecimal.TEN)
                .mesa(mesa)
                .items(new ArrayList<>())
                .build();
    }

    @Test
    void publicaElEstadoDeLaMesaDeUnaComandaDeSalon() {
        Mesa mesa = Mesa.builder().id(3L).numero(4).estado(MesaEstado.POR_COBRAR).build();

        OrdenResponse response = OrdenResponse.from(orden(mesa));

        assertThat(response.getMesaNumero()).isEqualTo(4);
        assertThat(response.getMesaEstado()).isEqualTo(MesaEstado.POR_COBRAR);
    }

    @Test
    void sinMesaElEstadoQuedaVacio() {
        OrdenResponse response = OrdenResponse.from(orden(null));

        assertThat(response.getMesaEstado()).isNull();
    }
}
