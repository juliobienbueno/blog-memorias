import React from 'react'

export default function Navbar() {
    return (
        <header>
            {/* El contenedor con la grilla */}
            <div className="header-content">

                {/* LADO IZQUIERDO: Logo, Cruz y Bajada (Zona Oscura) */}
                <div className="seccion-logo">
                    <div className="linea-titulo">
                        <h1>IGLESIA NUESTRA</h1>
                        <span className="cruz" aria-hidden="true">†</span>
                    </div>
                    <p className="bajada-texto">
                        Reflexiones y Historias de Nuestra Comunidad.
                    </p>
                </div>

                {/* LADO DERECHO: Menú de navegación (Zona Clara) */}
                <nav className="seccion-navegador">
                    <a href="#inicio">Inicio</a>
                    <a href="#columnas">Columnas</a>
                    <a href="#sobre-mi">Sobre Mí</a>
                    <a href="#contacto">Contacto</a>
                </nav>

            </div>
        </header>
    )
}