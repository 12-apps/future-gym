# Future Gym

Protótipo de app de academia em um único arquivo (`index.html`), sem build. Abra no navegador do celular ou do computador.

## O que faz

- **Início**: ficha da semana (divisão ABC), treino do dia e progresso semanal.
- **Treino**: lista de exercícios com séries, repetições, tempo de série, intervalo e última carga.
- **Execução**: ao iniciar um exercício o timer da série corre. No fim da série toca um alarme e começa o intervalo; no fim do intervalo toca outro som e a próxima série começa sozinha. Dá para parar/retomar, marcar a série como concluída antes do tempo, pular o intervalo ou somar 15 s, e seguir para o próximo exercício até **Concluir treino**.
- **Cargas**: kg e repetições anotados por série, salvos no aparelho e sugeridos no próximo treino.
- **Duelo**: adicione parceiros de treino (nome e peso corporal) e dispute a pontuação da semana:
  `pontos = tonelagem da semana (carga × repetições) ÷ peso corporal`.
  Treinando junto, você anota as cargas do parceiro na mesma tela; treinos que a pessoa fez sozinha entram como "treino avulso".
- **Histórico**: treinos concluídos com duração, séries e tonelagem.

Os dados ficam no `localStorage` do navegador. A ficha fica em `WORKOUTS` e `WEEK_PLAN`, no início do script.

## Rodar localmente

```sh
python3 -m http.server 8000
# abra http://localhost:8000
```
