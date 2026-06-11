import React from 'react'
import Navbar from './components/Navbar'
import ColumnaCard from './components/ColumnaCard'

export default function App() {
  const escritos = [
    {
      id: 1,
      titulo: "Memorias del Viejo Tranvía",
      fecha: "June 14, 2024",
      cuerpo: "Cada mañana, el sonido del riel me recordaba a un viejo mago del error; el tiempo... Aquí va el texto completo de la columna describiendo el viaje y los recuerdos del barrio.",
      imagen: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=500&auto=format&fit=crop&q=60"
    },
    {
      id: 2,
      titulo: "La Importancia del Tiempo",
      fecha: "June 10, 2024",
      cuerpo: "La importancia del tiempo es un tema central en la fe. Cada momento es una oportunidad para conectar con lo trascendente y reflexionar sobre nuestro camino comunitariamente..."
    },
    {
      id: 3,
      titulo: "Un Paseo por el Parque en Otoño",
      fecha: "June 05, 2024",
      cuerpo: "Un paseo por el parque en otoño es una experiencia espiritual. Los colores cálidos del paisaje, las hojas cayendo y el aire fresco nos invitan a meditar en la creación..."
    }
  ]

  return (
    <div className="min-h-screen flex flex-col">

      <Navbar />

      {/* 🎯 CAMBIO DE DISTRIBUCIÓN:
         max-w-[1126px] mantiene todo alineado con el Navbar.
         grid-cols-4 da el peso correcto: 1 parte para el perfil, 3 partes para los escritos. */}
      <main className="main-layout">

        {/* LADO IZQUIERDO: Perfil de Miguel (Barra lateral compacta) */}
        <section className="perfil-sidebar">
          <div className="perfil-contenedor-img">
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80"
              alt="Miguel A. Rodríguez"
            />
          </div>
          <h3>Miguel A. Rodríguez</h3>
          <p>
            Hola! Soy Miguel. Este es mi espacio para compartir mis pensamientos, relatos y experiencias con ustedes.
          </p>
        </section>

        {/* LADO DERECHO: Lista de escritos (Ocupa la gran mayoría del espacio) */}
        <section className="columnas-feed">
          {escritos.map((articulo) => (
            <ColumnaCard
              key={articulo.id}
              titulo={articulo.titulo}
              fecha={articulo.fecha}
              cuerpo={articulo.cuerpo}
              imagen={articulo.imagen}
            />
          ))}
        </section>

      </main>

    </div>
  )
}