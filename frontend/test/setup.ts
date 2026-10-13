// Matchers como toBeInTheDocument() para Vitest
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Limpia el DOM después de cada test para que no se acumulen renders
afterEach(() => cleanup())