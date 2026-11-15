package com.sistema.polleria.finance;

import com.sistema.polleria.finance.dto.BalanceDiarioResponse;
import com.sistema.polleria.finance.dto.CierreLiquidacionRequest;
import com.sistema.polleria.finance.dto.EmitirComprobanteRequest;
import com.sistema.polleria.finance.dto.RegistrarCobroRepartidorRequest;
import com.sistema.polleria.finance.entity.ArqueoCaja;
import com.sistema.polleria.finance.entity.CategoriaMovimiento;
import com.sistema.polleria.finance.entity.CobroRepartidor;
import com.sistema.polleria.finance.entity.ComprobantePago;
import com.sistema.polleria.finance.entity.EstadoCaja;
import com.sistema.polleria.finance.entity.EstadoLiquidacion;
import com.sistema.polleria.finance.entity.LiquidacionRepartidor;
import com.sistema.polleria.finance.entity.MovimientoCaja;
import com.sistema.polleria.finance.entity.TipoComprobante;
import com.sistema.polleria.finance.entity.TipoMovimiento;
import com.sistema.polleria.finance.repository.ArqueoCajaRepository;
import com.sistema.polleria.finance.repository.CobroRepartidorRepository;
import com.sistema.polleria.finance.repository.ComprobantePagoRepository;
import com.sistema.polleria.finance.repository.LiquidacionRepartidorRepository;
import com.sistema.polleria.finance.repository.MovimientoCajaRepository;
import com.sistema.polleria.finance.service.ComprobanteService;
import com.sistema.polleria.finance.service.FinanzasService;
import com.sistema.polleria.finance.service.LiquidacionService;
import com.sistema.polleria.finance.service.OrdenesClient;
import com.sistema.polleria.finance.service.PagosClient;
import com.sistema.polleria.finance.service.comprobante.FuenteTotalComprobante;
import com.sistema.polleria.finance.service.comprobante.GeneradorCorrelativo;
import com.sistema.polleria.finance.service.comprobante.RegistradorIngresoCaja;
import com.sistema.polleria.finance.service.comprobante.ValidadorDatosFiscales;
import com.sistema.polleria.finance.service.comprobante.ValidadorIngresoEfectivo;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class FinanceAuditHardeningTest {

    @Test
    void balanceDiarioNoDuplicaContraEntregaNiSumaComprobantesAnulados() {
        ArqueoCajaRepository arqueos = mock(ArqueoCajaRepository.class);
        MovimientoCajaRepository movimientos = mock(MovimientoCajaRepository.class);
        ComprobantePagoRepository comprobantes = mock(ComprobantePagoRepository.class);
        FinanzasService service = new FinanzasService(arqueos, movimientos, comprobantes);

        LocalDate dia = LocalDate.of(2026, 11, 15);
        when(arqueos.findByFechaAperturaBetweenOrderByFechaAperturaDesc(any(), any())).thenReturn(List.of());
        when(movimientos.findByFechaBetweenOrderByFechaDesc(any(), any())).thenReturn(List.of(
                MovimientoCaja.builder()
                        .tipo(TipoMovimiento.INGRESO)
                        .categoria(CategoriaMovimiento.RENDICION_REPARTIDOR)
                        .monto(new BigDecimal("50.00"))
                        .build()));
        when(comprobantes.findByEmitidoEnBetween(any(), any())).thenReturn(List.of(
                ComprobantePago.builder()
                        .ordenId(10L)
                        .total(new BigDecimal("50.00"))
                        .estadoPagoTexto("COBRAR EN EFECTIVO: S/ 50.00")
                        .anulado(false)
                        .build(),
                ComprobantePago.builder()
                        .ordenId(11L)
                        .total(new BigDecimal("80.00"))
                        .estadoPagoTexto("PAGADO")
                        .anulado(true)
                        .build()));

        BalanceDiarioResponse balance = service.obtenerBalanceDiario(dia);

        assertThat(balance.getIngresos().getEfectivoSalon()).isEqualByComparingTo("50.00");
        assertThat(balance.getIngresos().getPasarelaDigital()).isEqualByComparingTo("0.00");
        assertThat(balance.getIngresos().getTotalIngresos()).isEqualByComparingTo("50.00");
        assertThat(balance.getOrdenesAtendidas()).isEqualTo(1);
    }

    @Test
    void emitirValidaIngresoEfectivoYOrdenAntesDeTomarCorrelativo() {
        ComprobantePagoRepository repo = mock(ComprobantePagoRepository.class);
        FuenteTotalComprobante fuente = mock(FuenteTotalComprobante.class);
        ValidadorDatosFiscales fiscal = mock(ValidadorDatosFiscales.class);
        GeneradorCorrelativo correlativo = mock(GeneradorCorrelativo.class);
        RegistradorIngresoCaja ingreso = mock(RegistradorIngresoCaja.class);
        ValidadorIngresoEfectivo efectivo = mock(ValidadorIngresoEfectivo.class);
        OrdenesClient ordenesClient = mock(OrdenesClient.class);

        ComprobanteService service = new ComprobanteService(repo, fuente, fiscal, correlativo, ingreso, efectivo);
        ReflectionTestUtils.setField(service, "ordenesClient", ordenesClient);

        when(repo.findByOrdenId(77L)).thenReturn(Optional.empty());
        when(fuente.totalDe(77L, "Bearer t")).thenReturn(new BigDecimal("40.00"));
        doThrow(new IllegalStateException("El pago de la orden no fue en efectivo"))
                .when(efectivo).validar(77L, "Bearer t");

        EmitirComprobanteRequest req = new EmitirComprobanteRequest(
                77L, TipoComprobante.BOLETA, "DNI", "12345678", "Cliente", null, null, false, null, true);

        assertThatThrownBy(() -> service.emitir(req, 5L, "Bearer t"))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(correlativo, ingreso);

        doThrow(new IllegalStateException("Pedido cancelado")).when(ordenesClient).validarOrdenEmitible(78L);
        when(repo.findByOrdenId(78L)).thenReturn(Optional.empty());
        EmitirComprobanteRequest reqCancelado = new EmitirComprobanteRequest(
                78L, TipoComprobante.BOLETA, "DNI", "12345678", "Cliente", null, null, false, null, false);
        assertThatThrownBy(() -> service.emitir(reqCancelado, 5L, "Bearer t"))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(correlativo);
    }

    @Test
    void anularPorOrdenMarcaElComprobanteYEsIdempotente() {
        ComprobantePagoRepository repo = mock(ComprobantePagoRepository.class);
        ComprobanteService service = new ComprobanteService(
                repo,
                mock(FuenteTotalComprobante.class),
                mock(ValidadorDatosFiscales.class),
                mock(GeneradorCorrelativo.class),
                mock(RegistradorIngresoCaja.class),
                mock(ValidadorIngresoEfectivo.class));

        ComprobantePago comp = ComprobantePago.builder()
                .id(1L).ordenId(90L).tipo(TipoComprobante.BOLETA).serieCorrelativo("B001-000010")
                .clienteNombre("Cliente").subtotal(new BigDecimal("8.47")).igv(new BigDecimal("1.53"))
                .total(BigDecimal.TEN).estadoPagoTexto("COBRAR EN EFECTIVO: S/ 10.00")
                .anulado(false).emitidoEn(LocalDateTime.now()).build();
        when(repo.findByOrdenIdParaActualizar(90L)).thenReturn(Optional.of(comp));
        when(repo.save(any(ComprobantePago.class))).thenAnswer(inv -> inv.getArgument(0));

        var res1 = service.anularPorOrden(90L, "Cliente anuló", 3L);
        assertThat(res1.anulado()).isTrue();
        assertThat(res1.motivoAnulacion()).isEqualTo("Cliente anuló");

        var res2 = service.anularPorOrden(90L, "Otro motivo", 3L);
        assertThat(res2.anulado()).isTrue();
        verify(repo, times(1)).save(comp);
    }

    @Test
    void cerrarLiquidacionComiteaAntesDeMarcarPagosYRegistrarCobroUsaBloqueo() {
        LiquidacionRepartidorRepository liqRepo = mock(LiquidacionRepartidorRepository.class);
        CobroRepartidorRepository cobroRepo = mock(CobroRepartidorRepository.class);
        ArqueoCajaRepository arqueoRepo = mock(ArqueoCajaRepository.class);
        MovimientoCajaRepository movRepo = mock(MovimientoCajaRepository.class);
        PagosClient pagosClient = mock(PagosClient.class);
        PlatformTransactionManager txManager = spy(new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
            }

            @Override
            public void rollback(TransactionStatus status) {
            }
        });

        LiquidacionService service = new LiquidacionService(liqRepo, cobroRepo, arqueoRepo, movRepo, pagosClient);
        ReflectionTestUtils.setField(service, "transactionManager", txManager);

        ArqueoCaja caja = ArqueoCaja.builder().id(10L).estado(EstadoCaja.ABIERTA).build();
        when(arqueoRepo.findFirstWithLockByEstadoOrderByFechaAperturaDesc(EstadoCaja.ABIERTA))
                .thenReturn(Optional.of(caja));
        LiquidacionRepartidor liq = LiquidacionRepartidor.builder()
                .id(77L).repartidorId(4L).repartidorNombre("Juan")
                .fondoInicial(BigDecimal.ZERO).estado(EstadoLiquidacion.ABIERTA).build();
        when(liqRepo.findByIdParaActualizar(77L)).thenReturn(Optional.of(liq));
        when(liqRepo.save(any(LiquidacionRepartidor.class))).thenAnswer(inv -> inv.getArgument(0));
        when(cobroRepo.sumMontoByLiquidacionId(77L)).thenReturn(BigDecimal.ZERO);
        when(pagosClient.obtenerPendiente(4L, null, "Bearer t")).thenReturn(new PagosClient.EfectivoPendiente(
                4L, new BigDecimal("50.00"), 1,
                List.of(new PagosClient.EfectivoPendiente.Item(99L, 500L, new BigDecimal("50.00"), null))));

        service.cerrar(77L, new CierreLiquidacionRequest(new BigDecimal("50.00"), new BigDecimal("50.00"), null), 2L, "Bearer t");

        InOrder orden = inOrder(liqRepo, txManager, pagosClient);
        orden.verify(liqRepo).save(any(LiquidacionRepartidor.class));
        orden.verify(txManager).commit(any());
        orden.verify(pagosClient).liquidar(List.of(99L), 77L, "Bearer t");
        orden.verify(liqRepo).limpiarPagosPendientes(77L);

        // Registrar cobro también usa lock pesimista sobre la liquidación abierta del repartidor
        when(liqRepo.findFirstWithLockByRepartidorIdAndEstado(4L, EstadoLiquidacion.ABIERTA)).thenReturn(Optional.of(liq));
        liq.setEstado(EstadoLiquidacion.ABIERTA);
        when(cobroRepo.save(any(CobroRepartidor.class))).thenAnswer(inv -> {
            CobroRepartidor c = inv.getArgument(0);
            c.setId(5L);
            return c;
        });
        service.registrarCobro(new RegistrarCobroRepartidorRequest(4L, "Juan", new BigDecimal("50.00"), null), 2L, "Bearer t");
        verify(liqRepo).findFirstWithLockByRepartidorIdAndEstado(eq(4L), eq(EstadoLiquidacion.ABIERTA));
    }
}
