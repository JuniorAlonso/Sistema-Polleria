package com.sistema.polleria.orders.config;

import com.sistema.polleria.orders.entity.Categoria;
import com.sistema.polleria.orders.entity.Mesa;
import com.sistema.polleria.orders.entity.MesaEstado;
import com.sistema.polleria.orders.entity.Producto;
import com.sistema.polleria.orders.repository.MesaRepository;
import com.sistema.polleria.orders.repository.ProductoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.util.List;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataInitializer {

    private final ProductoRepository productoRepository;
    private final MesaRepository mesaRepository;

    @Bean
    public CommandLineRunner initOrdersData() {
        return args -> {
            // 1. Inicializar Mesas
            if (mesaRepository.count() == 0) {
                log.info("Inicializando mesas del salón para despliegue...");
                List<Mesa> mesas = List.of(
                        Mesa.builder().numero(1).capacidad(4).estado(MesaEstado.LIBRE).posicionX(1).posicionY(1).zona("SALON_PRINCIPAL").activo(true).build(),
                        Mesa.builder().numero(2).capacidad(4).estado(MesaEstado.LIBRE).posicionX(2).posicionY(1).zona("SALON_PRINCIPAL").activo(true).build(),
                        Mesa.builder().numero(3).capacidad(6).estado(MesaEstado.LIBRE).posicionX(3).posicionY(1).zona("SALON_PRINCIPAL").activo(true).build(),
                        Mesa.builder().numero(4).capacidad(2).estado(MesaEstado.LIBRE).posicionX(1).posicionY(2).zona("SALON_PRINCIPAL").activo(true).build(),
                        Mesa.builder().numero(5).capacidad(8).estado(MesaEstado.LIBRE).posicionX(2).posicionY(2).zona("TERRAZA").activo(true).build()
                );
                mesaRepository.saveAll(mesas);
                log.info("{} mesas inicializadas exitosamente con coordenadas de plano virtual.", mesas.size());
            }

            // 2. Inicializar Carta de Productos
            if (productoRepository.count() == 0) {
                log.info("Inicializando carta de productos oficiales para despliegue...");
                List<Producto> productos = List.of(
                        Producto.builder()
                                .nombre("1 Pollo a la Brasa Clásico")
                                .descripcion("1 Pollo entero al carbón con papas fritas y ensalada clásica")
                                .precio(new BigDecimal("65.50"))
                                .categoria(Categoria.POLLO_ENTERO)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("1/2 Pollo a la Brasa")
                                .descripcion("Medio pollo al carbón con papas crocantes y ensalada fresca")
                                .precio(new BigDecimal("36.00"))
                                .categoria(Categoria.MEDIO_POLLO)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("1/4 Pollo a la Brasa")
                                .descripcion("Porción individual (pecho o pierna) con papas fritas y ensalada")
                                .precio(new BigDecimal("21.00"))
                                .categoria(Categoria.CUARTO_POLLO)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("Combo Familiar San Pollo")
                                .descripcion("1 Pollo entero + papas familiares + ensalada + gaseosa 1.5L")
                                .precio(new BigDecimal("89.90"))
                                .categoria(Categoria.COMBO)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("Anticuchos Clásicos (2 Palos)")
                                .descripcion("Corazón de res marinado en ají panca con papas doradas y choclo")
                                .precio(new BigDecimal("24.00"))
                                .categoria(Categoria.PARRILLA)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("Porción de Papas Nativas Fritas")
                                .descripcion("Papas amarillas crocantes con cremas de la casa")
                                .precio(new BigDecimal("14.00"))
                                .categoria(Categoria.GUARNICION)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("Inca Kola 1.5L")
                                .descripcion("Gaseosa tradicional helada")
                                .precio(new BigDecimal("12.00"))
                                .categoria(Categoria.BEBIDA)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("Chicha Morada Natural 1L")
                                .descripcion("Elaborada con maíz morado, piña, manzana y canela")
                                .precio(new BigDecimal("10.00"))
                                .categoria(Categoria.BEBIDA)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("Torta de Chocolate de la Casa")
                                .descripcion("Bizcocho húmedo de chocolate con abundante fudge artesanal")
                                .precio(new BigDecimal("15.00"))
                                .categoria(Categoria.POSTRE)
                                .disponible(true)
                                .build(),
                        Producto.builder()
                                .nombre("Promoción Almuerzo Ejecutivo")
                                .descripcion("1/4 de pollo + papas + ensalada + vaso de chicha")
                                .precio(new BigDecimal("25.00"))
                                .categoria(Categoria.PROMOCION)
                                .disponible(true)
                                .build()
                );
                productoRepository.saveAll(productos);
                log.info("{} productos inicializados en la carta oficial.", productos.size());
            }
        };
    }
}
