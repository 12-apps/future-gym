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
- **Treinos (montar a ficha)**: escolha a divisão (Full body, AB, ABC, ABCD, ABCDE) ou monte a sua dia a dia; crie até 6 treinos (A a F), dê nome a cada um e cadastre os exercícios com séries, repetições, tempo de série, intervalo e carga inicial. Dá para reordenar, editar e remover. O campo de exercício sugere nomes comuns e preenche o músculo.
- **Subgrupos musculares**: cada treino mostra os grupos trabalhados (sugeridos pelo nome, ex.: "Pernas") e divide cada grupo em subgrupos (peitoral superior/médio/inferior, deltoide anterior/lateral/posterior, cabeças do bíceps e tríceps, vastos × reto femoral etc.). O que ficar sem exercício ganha sugestões que você adiciona com um toque.
- **Volume semanal (under/overtraining)**: séries por semana de cada grupo, somando todos os dias da ficha (compostos contam meia série para os auxiliares). Escolha o objetivo — Cutting, Manutenção ou Bulking — e a faixa ideal e o limite mudam: em bulking a faixa sobe; em cutting o teto cai. Cada grupo aparece como Abaixo (undertraining), Ideal, Alto ou Excesso (overtraining). As faixas partem dos marcos de volume MEV/MRV por grupo, definidos em `GROUPS`.
- **Histórico**: treinos concluídos com duração, séries e tonelagem.

Os dados ficam no `localStorage` do navegador. A ficha de exemplo (usada até você editar) fica em `DEFAULT_WORKOUTS` e `DEFAULT_WEEK`, no início do script.

## Rodar localmente

```sh
python3 -m http.server 8000
# abra http://localhost:8000
```
