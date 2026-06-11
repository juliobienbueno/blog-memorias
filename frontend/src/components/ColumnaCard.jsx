import React from 'react'

export default function ColumnaCard({ titulo, fecha, cuerpo, imagen }) {
    return (
        <article className={`tarjeta-columna ${imagen ? 'con-imagen' : 'solo-texto'}`}>

            {/* Si el artículo tiene imagen, la renderizamos en su propio contenedor */}
            {imagen && (
                <div className="tarjeta-contenedor-img">
                    <img src={imagen} alt={titulo} className="tarjeta-img" />
                </div>
            )}

            {/* Bloque de textos del artículo */}
            <div className="tarjeta-info">
                <h2 className="tarjeta-titulo">{titulo}</h2>
                <span className="tarjeta-fecha">{fecha}</span>
                <p className="tarjeta-cuerpo">{cuerpo}</p>
                <a href="#" className="tarjeta-leer-mas">Read more...</a>
            </div>

        </article>
    )
}