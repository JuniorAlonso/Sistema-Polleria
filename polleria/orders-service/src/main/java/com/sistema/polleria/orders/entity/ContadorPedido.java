package com.sistema.polleria.orders.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Contador de "número de pedido del cliente" ("tu pedido N.° 3").
 *
 * Existe una sola fila por cliente con cuenta (clave {@code C:<clienteId>}) o por celular
 * de invitado (clave {@code T:<celularNormalizado>}). La fila se bloquea de forma pesimista
 * durante la asignación, de modo que dos mozos que toman un pedido del mismo cliente al
 * mismo tiempo no pueden obtener el mismo número.
 */
@Entity
@Table(name = "contador_pedido")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ContadorPedido {

    @Id
    @Column(name = "clave", length = 64, nullable = false)
    private String clave;

    @Column(name = "ultimo", nullable = false)
    private Integer ultimo;
}
