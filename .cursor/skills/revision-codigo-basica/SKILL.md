---
name: revision-codigo-basica
description: Revisa cambios con un checklist mínimo de calidad, seguridad y mantenibilidad. Usar en code review, antes de merge, o cuando el usuario pida revisar un diff o un PR.
---

# Revisión de código básica

## Checklist

1. **Correctitud**: ¿El cambio resuelve el problema sin efectos colaterales obvios? ¿Casos límite y errores manejados?
2. **Seguridad**: ¿Entradas validadas? ¿Sin secretos o datos sensibles en código o logs?
3. **Mantenibilidad**: ¿Nombres claros? ¿Funciones razonablemente acotadas? ¿Duplicación evitable reutilizando código existente?
4. **Tests**: ¿Hay cobertura mínima para lo nuevo o lo crítico? ¿Los existentes siguen teniendo sentido?
5. **Rendimiento**: ¿Consultas o bucles obviamente costosos en rutas calientes?

## Formato de feedback

- **Bloqueante**: debe corregirse antes de merge.
- **Sugerencia**: mejora recomendada, no obligatoria.
- **Nit**: detalle menor (estilo, nombres).

Incluir referencias a archivos o líneas cuando sea posible.
