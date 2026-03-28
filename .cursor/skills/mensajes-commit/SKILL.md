---
name: mensajes-commit
description: Redacta mensajes de commit claros y consistentes a partir del diff o de la descripción del cambio. Usar cuando el usuario pida un commit, un mensaje de commit, o ayuda para commitear cambios.
---

# Mensajes de commit

## Formato recomendado (Conventional Commits)

```
<tipo>(<ámbito opcional>): <descripción en imperativo, corta>

[cuerpo opcional: qué y por qué, no cómo línea a línea]

[footer opcional: BREAKING CHANGE:, closes #123]
```

**Tipos habituales**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`.

## Reglas

1. Línea de asunto ≤ ~72 caracteres, sin punto final, en imperativo ("añade", "corrige", no "añadido").
2. Un cambio lógico por commit cuando sea posible; si el diff mezcla temas, sugerir varios commits.
3. Mencionar rupturas de compatibilidad en el cuerpo o con `BREAKING CHANGE:`.

## Ejemplo

**Entrada**: Se corrigió el cálculo de IVA y se añadió test.

**Salida**:

```
fix(billing): corrige cálculo de IVA en facturas

Ajusta el redondeo según normativa local. Añade casos de prueba para
importes con decimales.
```
