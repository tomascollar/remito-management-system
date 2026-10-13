/**
 * Configuración de Jest para el backend.
 * - ts-jest compila TypeScript al vuelo (no hace falta compilar antes de probar).
 * - Los tests viven en test/ y terminan en .test.ts.
 * - test/preparar-entorno.ts se ejecuta antes de cargar cualquier módulo: define las variables
 *   de entorno que la app exige al arrancar.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/test/preparar-entorno.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json' }] },
  clearMocks: true,
};
