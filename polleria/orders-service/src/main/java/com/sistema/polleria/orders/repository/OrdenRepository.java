package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OrdenRepository extends JpaRepository<Orden, Long> {

    List<Orden> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    List<Orden> findByTipoOrderByCreadoEnDesc(OrdenTipo tipo);

    List<Orden> findByEstadoOrderByCreadoEnDesc(OrdenEstado estado);

    // Todos los pedidos ordenados por fecha descendente
    List<Orden> findAllByOrderByCreadoEnDesc();

    // Pedidos activos (todo lo que no sea ENTREGADO o CANCELADO)
    @Query("SELECT o FROM Orden o WHERE o.estado NOT IN ('ENTREGADO', 'CANCELADO') ORDER BY o.creadoEn ASC")
    List<Orden> findActivos();

    // Pedidos activos + pedidos completados del día de hoy
    @Query("SELECT o FROM Orden o WHERE o.estado NOT IN ('ENTREGADO', 'CANCELADO') OR (o.estado = 'ENTREGADO' AND CAST(o.creadoEn AS date) = CURRENT_DATE) ORDER BY o.creadoEn DESC")
    List<Orden> findActivosYCompletadosHoy();

    // Pedidos activos de cocina (los que cocina debe ver)
    @Query("SELECT o FROM Orden o WHERE o.estado IN ('RECIBIDO', 'EN_PREPARACION') ORDER BY o.creadoEn ASC")
    List<Orden> findParaCocina();

    List<Orden> findByRepartidorIdAndEstado(Long repartidorId, OrdenEstado estado);

    List<Orden> findByMesaIdAndEstadoNotIn(Long mesaId, List<OrdenEstado> estados);
}
