# Skills vendoradas

Cópia local e commitada, nunca linkada em marketplace com auto-update — regra 2
do D-010: atualização automática é supply chain. Project-local, nunca
`~/.claude/skills/` (regra 3: raio de explosão de um repo).

O `CLAUDE.md` tem precedência sobre qualquer coisa escrita aqui dentro.

## Origem

| | |
|---|---|
| Upstream | https://github.com/obra/superpowers |
| Versão | v6.3.0 |
| Commit | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` (12/08/2026) |
| Licença | MIT — Copyright (c) 2025 Jesse Vincent |

Baixado do SHA pinado, não de `main`. `sha256` confere com a cópia que foi lida
na revisão (regra 1 do D-010: ler o `SKILL.md` inteiro antes de instalar):

```
74edf03ea6d24ef53db48677b93558d14a979bdf052ca3f57ecdca0c66791608  brainstorming/SKILL.md
48508f44bbfd7d24b029fbf3a314f3cd14c9615599059366e922f47b8dc08cf2  writing-plans/SKILL.md
```

(Os dois hashes acima são do arquivo **verbatim**, antes do patch. Servem para
comparar contra o upstream, não contra o que está no disco hoje.)

## O que foi vendorado

- `brainstorming/SKILL.md`
- `writing-plans/SKILL.md`

Cópia byte-a-byte no commit **`0e8a45a`**.

## O que ficou de fora

- **Visual companion do `brainstorming`** — `visual-companion.md` e 5 arquivos em
  `scripts/` (~60KB, incluindo um servidor HTTP local em Node de 25KB e dois
  scripts de shell). A regra 1 do D-010 (ler o `SKILL.md` inteiro antes de
  instalar) é viável porque o `SKILL.md` é curto; 60KB de JS e shell de terceiro
  não recebe leitura do mesmo nível, e pinar num SHA garante que não muda, não
  que seja bom. Ver **P-07** no `docs/DECISOES.md` para a condição de reentrada.
- `spec-document-reviewer-prompt.md` e `plan-document-reviewer-prompt.md` —
  nenhum dos dois `SKILL.md` os referencia.

## Patches locais

Num único commit: **`33881d4`**. **O diff é o próprio commit** — não está
replicado aqui de propósito, porque prosa descrevendo diff desatualiza e diff
não. Numa atualização de upstream, reaplique esse commit sobre a versão nova em
vez de reconciliar uma descrição escrita à mão.

Motivos:

1. **D-010 exclui `subagent-driven-development`, `executing-plans` e
   `using-git-worktrees`**, e o `CLAUDE.md` manda uma etapa por vez com parada
   para revisão. O `writing-plans` upstream referencia as três e recomenda a
   primeira. O `brainstorming` **não** tinha esse problema — zero referência.
2. **Visual companion removido** (acima), com o passo correspondente do checklist
   arquitetural, em vez de deixar referência pendurada.
3. **Caminho de spec e plano** apontado para `docs/fase-<n>/f<n>-e<m>-spec.md` e
   `-plano.md`, conforme D-015. Os dois `SKILL.md` dizem explicitamente que
   preferência do projeto sobrescreve o default deles.

## Referência externa que ficou

`brainstorming/SKILL.md:207` cita `elements-of-style:writing-clearly-and-concisely`
com "if available". Não está vendorada e não vai ser: a referência é condicional
por construção (degrada sozinha se a skill não existir), e D-010 não a exclui.

## `.prettierignore`

`.claude/skills/` está na lista. O Prettier reflui o markdown das duas e
reformatar destruiria a única coisa que torna a cópia auditável — o diff contra
o upstream.
