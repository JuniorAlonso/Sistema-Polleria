package com.sistema.polleria.finance.entity;

/**
 * What a cash movement is, so reports do not have to guess from its text (plan 03, R3.10).
 * Movements stored before this column have no category and are reported as before.
 *
 * <p>Adding a value later also needs the database check constraint Hibernate created for the column.
 */
public enum CategoriaMovimiento {
    /** Cash income of a sale charged at the POS. */
    VENTA,
    /** Change float handed to a courier (EGRESO) or returned by them (INGRESO): not a sale, not an expense. */
    FONDO_REPARTIDOR,
    /** Sales cash handed in by a courier. */
    RENDICION_REPARTIDOR,
    /** Movement typed by the cashier or admin. */
    MANUAL,
    /** Cash handed back to a customer for an accepted claim (EGRESO, at most once per claim). */
    DEVOLUCION
}
