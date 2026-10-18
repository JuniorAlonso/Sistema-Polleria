package com.sistema.polleria.orders.repository;

import com.sistema.polleria.orders.entity.Orden;
import com.sistema.polleria.orders.entity.OrdenEstado;
import com.sistema.polleria.orders.entity.OrdenTipo;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrdenRepository extends JpaRepository<Orden, Long> {

    /**
     * Los listados se devuelven como DTO y recorren `items` + `items.producto`. El grafo evita el
     * N+1 de ítems/productos y permite mapear fuera de la sesión (open-in-view=false) dentro de la
     * transacción de lectura del servicio.
     */
    @EntityGraph(attributePaths = {"items", "items.producto"})
    List<Orden> findByClienteIdOrderByCreadoEnDesc(Long clienteId);

    @EntityGraph(attributePaths = {"items", "items.producto"})
    List<Orden> findByTipoOrderByCreadoEnDesc(OrdenTipo tipo);

    @EntityGraph(attributePaths = {"items", "items.producto"})
    List<Orden> findByEstadoOrderByCreadoEnDesc(OrdenEstado estado);

    // Todos los pedidos ordenados por fecha descendente
    @EntityGraph(attributePaths = {"items", "items.producto"})
    List<Orden> findAllByOrderByCreadoEnDesc();

    // Pedidos activos (todo lo que no sea ENTREGADO o CANCELADO)
    @EntityGraph(attributePaths = {"items", "items.producto"})
    @Query("SELECT o FROM Orden o WHERE o.estado NOT IN ('ENTREGADO', 'CANCELADO') ORDER BY o.creadoEn ASC")
    List<Orden> findActivos();

    // Pedidos activos + completados del día de hoy. El completado se fecha por `actualizadoEn`:
    // una comanda creada antes de medianoche y cobrada después también cuenta para hoy.
    @EntityGraph(attributePaths = {"items", "items.producto"})
    @Query("SELECT o FROM Orden o WHERE o.estado NOT IN ('ENTREGADO', 'CANCELADO') " +
           "OR (o.estado = 'ENTREGADO' AND CAST(o.actualizadoEn AS date) = CURRENT_DATE) " +
           "ORDER BY o.creadoEn DESC")
    List<Orden> findActivosYCompletadosHoy();

    // Pedidos activos de cocina (los que cocina debe ver)
    @EntityGraph(attributePaths = {"items", "items.producto"})
    @Query("SELECT o FROM Orden o WHERE o.estado IN ('RECIBIDO', 'EN_PREPARACION') ORDER BY o.creadoEn ASC")
    List<Orden> findParaCocina();

    List<Orden> findByRepartidorIdAndEstado(Long repartidorId, OrdenEstado estado);

    List<Orden> findByMesaIdAndEstadoNotIn(Long mesaId, List<OrdenEstado> estados);

    /**
     * Una sola consulta para enriquecer todas las mesas del salón: reemplaza el N+1 de
     * `findByMesaIdAndEstadoNotIn` por mesa en `MesaService.listarTodas`.
     */
    List<Orden> findByMesaIdInAndEstadoNotIn(Collection<Long> mesaIds, List<OrdenEstado> estados);

    /**
     * Bloqueo pesimista para mutaciones idempotentes o acumulativas (servir, agregar ítems):
     * dos peticiones simultáneas se serializan y la segunda ve la marca/ítems de la primera.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Orden o WHERE o.id = :id")
    Optional<Orden> buscarConBloqueo(@Param("id") Long id);

    // ─── Número de pedido por cliente ───────────────────────────────

    @Query("SELECT COALESCE(MAX(o.numeroCliente), 0) FROM Orden o WHERE o.clienteId = :clienteId")
    Integer maxNumeroPorCliente(@Param("clienteId") Long clienteId);

    // Invitados (sin cuenta): se numera por celular
    @Query("SELECT COALESCE(MAX(o.numeroCliente), 0) FROM Orden o " +
           "WHERE (o.clienteId IS NULL OR o.clienteId = 0) AND o.telefonoCliente IN :telefonos")
    Integer maxNumeroPorTelefono(@Param("telefonos") Collection<String> telefonos);

    List<Orden> findByNumeroClienteIsNullOrderByIdAsc();

    // ─── Seguimiento por celular ────────────────────────────────────

    boolean existsByTelefonoClienteIn(Collection<String> telefonos);

    List<Orden> findTop20ByTelefonoClienteInOrderByCreadoEnDesc(Collection<String> telefonos);
}
