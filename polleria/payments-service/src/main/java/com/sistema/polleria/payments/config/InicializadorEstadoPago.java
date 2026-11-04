package com.sistema.polleria.payments.config;

import com.sistema.polleria.payments.entity.EstadoPago;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Realinea el esquema de {@code pagos.estado} con el enum {@link EstadoPago}.
 *
 * <p>Hibernate genera la columna y su CHECK a partir de las anotaciones, pero
 * {@code ddl-auto=update} <b>no modifica lo que ya existe</b>: ni ensancha una columna, ni agrega
 * valores a un CHECK. En una base con datos, entonces, el estado nuevo
 * {@code PENDIENTE_VERIFICACION} (22 caracteres) no entraba en {@code varchar(20)} y además no
 * estaba permitido por {@code pagos_estado_check}: la primera evidencia de Yape real fallaba con
 * violación de integridad y el endpoint respondía 409. El mismo CHECK tampoco contemplaba
 * {@code REEMBOLSADO} ni {@code REEMBOLSADO_PARCIAL}, así que los reembolsos de RF29 iban a fallar
 * igual.
 *
 * <p>Los tests no lo detectan porque el perfil de pruebas usa {@code create-drop}: la tabla se crea
 * desde las anotaciones, con el ancho y el CHECK correctos. Este inicializador cubre el caso de una
 * base que ya existe, y es idempotente.
 *
 * <p>Si algo falla se registra en <b>ERROR</b> (no en silencio: ocultar el motivo de un fallo de
 * esquema es lo que hizo que este bug tardara en aparecer) y el servicio igual arranca, porque
 * corregir el esquema de pagos no debe tumbar el resto de las formas de pago. Al final deja en el
 * log la definición real de la restricción, que es la prueba de que la corrección se aplicó.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class InicializadorEstadoPago implements ApplicationRunner {

    /**
     * Todos los valores del enum. Al agregar un estado nuevo a {@link EstadoPago}, se agrega acá:
     * una base existente no lo va a permitir sola, y el fallo se ve como un 409 que parece un
     * pago duplicado.
     */
    private static final String VALORES_ESTADO = "'PENDIENTE','APROBADO','RECHAZADO','CANCELADO',"
            + "'REEMBOLSADO','REEMBOLSADO_PARCIAL','PENDIENTE_VERIFICACION'";

    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ensancharColumna();
        realinearCheck();
        logDefinicionActual();
    }

    /** Deja el ancho que declara la entidad ({@code length = 30}). */
    private void ensancharColumna() {
        try {
            entityManager
                    .createNativeQuery("ALTER TABLE pagos ALTER COLUMN estado TYPE varchar(30)")
                    .executeUpdate();
        } catch (Exception e) {
            log.error("No se pudo ensanchar pagos.estado: {}", e.getMessage());
        }
    }

    /** Rehace el CHECK con todos los valores del enum, sin depender de cuál estaba antes. */
    private void realinearCheck() {
        try {
            entityManager
                    .createNativeQuery("ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_estado_check")
                    .executeUpdate();
            entityManager
                    .createNativeQuery("ALTER TABLE pagos ADD CONSTRAINT pagos_estado_check "
                            + "CHECK (estado IN (" + VALORES_ESTADO + "))")
                    .executeUpdate();
        } catch (Exception e) {
            log.error("No se pudo realinear pagos_estado_check: {}. "
                    + "Los pagos con estados nuevos van a fallar con violación de integridad.", e.getMessage());
        }
    }

    /** La definición real, en el log: sin esto no se puede saber si la corrección se aplicó. */
    private void logDefinicionActual() {
        try {
            Object definicion = entityManager
                    .createNativeQuery("SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                            + "WHERE conname = 'pagos_estado_check'")
                    .getSingleResult();
            log.info("pagos_estado_check = {}", definicion);
        } catch (Exception e) {
            log.warn("No se pudo leer la definición de pagos_estado_check: {}", e.getMessage());
        }
    }
}
