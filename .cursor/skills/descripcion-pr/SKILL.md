---
name: descripcion-pr
description: Genera descripciones de pull request estructuradas (contexto, cambios, verificación). Usar al abrir un PR, revisar un branch antes de merge, o cuando el usuario pida una descripción de cambios para revisión.
---

# Descripción de Pull Request

## Plantilla

Usar esta estructura; omitir secciones que no apliquen.

```markdown
## Contexto
[Problema o objetivo en una o dos frases]

## Cambios
- [Lista breve de cambios funcionales o técnicos]

## Cómo probar
1. [Pasos concretos]
2. [Comandos si aplica]

## Riesgos / notas
[Regresiones posibles, migraciones, feature flags]

## Checklist
- [ ] Tests / linters ejecutados si el repo los tiene
- [ ] Documentación actualizada si el comportamiento cambió para usuarios
```

## Buenas prácticas

- Enlazar issues (`Closes #`, `Refs #`) cuando existan.
- Destacar cambios que rompen compatibilidad al inicio.
- Mantener el tono factual; evitar párrafos largos sin estructura.
