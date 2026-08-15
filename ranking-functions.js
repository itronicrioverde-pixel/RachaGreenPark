/*
 * Green Park FC - Ranking V1
 * Artilharia + Goleiro Menos Vazado
 *
 * Anexar ao final de functions/index.js.
 * Usa onCall, HttpsError, getFirestore e FieldValue
 * já importados no arquivo principal.
 */

const GREEN_PARK_ADMIN_UID_RANKING =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";


function rankingAdminOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "É necessário estar autenticado.",
    );
  }

  if (
    request.auth.uid !==
    GREEN_PARK_ADMIN_UID_RANKING
  ) {
    throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode alterar o ranking.",
    );
  }
}


function safeRankingName(value) {
  return String(value || "Jogador")
      .trim()
      .slice(0, 60);
}


exports.listarConfirmados = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "É necessário estar autenticado.",
        );
      }

      const db = getFirestore();

      const snapshot =
        await db
            .collection("players")
            .where("status", "==", "confirmed")
            .get();

      const players =
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {};

          let confirmedAt = 0;

          if (
            data.confirmedAt &&
            typeof data.confirmedAt.toMillis ===
              "function"
          ) {
            confirmedAt =
              data.confirmedAt.toMillis();
          }

          return {
            id: docSnap.id,
            name: safeRankingName(data.name),
            confirmedAt,
          };
        });

      players.sort((a, b) => {
        if (a.confirmedAt && b.confirmedAt) {
          return a.confirmedAt -
            b.confirmedAt;
        }

        if (a.confirmedAt) return -1;
        if (b.confirmedAt) return 1;

        return a.name.localeCompare(
            b.name,
            "pt-BR",
        );
      });

      return {
        count: players.length,
        players: players.slice(0, 100),
      };
    },
);


exports.carregarRankingRacha = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      rankingAdminOrThrow(request);

      const matchKey =
        String(request.data?.matchKey || "")
            .trim()
            .slice(0, 80);

      if (!matchKey) {
        throw new HttpsError(
            "invalid-argument",
            "Racha inválido.",
        );
      }

      const db = getFirestore();

      const snapshot =
        await db
            .collection("ranking_rounds")
            .doc(matchKey)
            .get();

      if (!snapshot.exists) {
        return {
          exists: false,
          scorers: [],
          goalkeepers: [],
        };
      }

      const data = snapshot.data() || {};

      return {
        exists: true,
        scorers:
          Array.isArray(data.scorers) ?
            data.scorers :
            [],
        goalkeepers:
          Array.isArray(data.goalkeepers) ?
            data.goalkeepers :
            [],
      };
    },
);


async function recomputeRankingGreenPark(db) {
  const snapshot =
    await db
        .collection("ranking_rounds")
        .get();

  const playerMap = new Map();

  function getPlayer(playerId, name) {
    if (!playerMap.has(playerId)) {
      playerMap.set(playerId, {
        playerId,
        name: safeRankingName(name),
        goals: 0,
        goalkeeperGames: 0,
        goalsConceded: 0,
      });
    }

    const entry = playerMap.get(playerId);

    if (name) {
      entry.name = safeRankingName(name);
    }

    return entry;
  }

  snapshot.docs.forEach((docSnap) => {
    const round = docSnap.data() || {};

    const scorerMap = new Map();

    (
      Array.isArray(round.scorers) ?
        round.scorers :
        []
    ).forEach((item) => {
      const playerId =
        String(item.playerId || "").trim();

      if (!playerId) return;

      const goals =
        Math.max(
            0,
            Math.floor(
                Number(item.goals) || 0,
            ),
        );

      if (!scorerMap.has(playerId)) {
        scorerMap.set(playerId, {
          playerId,
          name: item.name,
          goals: 0,
        });
      }

      scorerMap.get(playerId).goals += goals;
    });

    scorerMap.forEach((item) => {
      const player =
        getPlayer(
            item.playerId,
            item.name,
        );

      player.goals += item.goals;
    });

    const goalkeeperMap = new Map();

    (
      Array.isArray(round.goalkeepers) ?
        round.goalkeepers :
        []
    ).forEach((item) => {
      const playerId =
        String(item.playerId || "").trim();

      if (!playerId) return;

      goalkeeperMap.set(playerId, {
        playerId,
        name: item.name,
        goalsConceded:
          Math.max(
              0,
              Math.floor(
                  Number(
                      item.goalsConceded,
                  ) || 0,
              ),
          ),
      });
    });

    goalkeeperMap.forEach((item) => {
      const player =
        getPlayer(
            item.playerId,
            item.name,
        );

      player.goalkeeperGames += 1;
      player.goalsConceded +=
        item.goalsConceded;
    });
  });

  const all =
    Array.from(playerMap.values());

  const scorers =
    all
        .filter((item) => item.goals > 0)
        .sort((a, b) => {
          if (b.goals !== a.goals) {
            return b.goals - a.goals;
          }

          return a.name.localeCompare(
              b.name,
              "pt-BR",
          );
        })
        .map((item) => ({
          playerId: item.playerId,
          name: item.name,
          goals: item.goals,
        }));

  const goalkeepers =
    all
        .filter(
            (item) =>
              item.goalkeeperGames >= 3,
        )
        .map((item) => ({
          playerId: item.playerId,
          name: item.name,
          games: item.goalkeeperGames,
          goalsConceded:
            item.goalsConceded,
          average:
            item.goalkeeperGames > 0 ?
              item.goalsConceded /
                item.goalkeeperGames :
              0,
        }))
        .sort((a, b) => {
          if (a.average !== b.average) {
            return a.average - b.average;
          }

          if (
            a.goalsConceded !==
            b.goalsConceded
          ) {
            return a.goalsConceded -
              b.goalsConceded;
          }

          if (b.games !== a.games) {
            return b.games - a.games;
          }

          return a.name.localeCompare(
              b.name,
              "pt-BR",
          );
        });

  await db
      .collection("ranking")
      .doc("current")
      .set(
          {
            scorers,
            goalkeepers,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

  return {
    scorers,
    goalkeepers,
  };
}


exports.salvarRankingRacha = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 30,
    },
    async (request) => {
      rankingAdminOrThrow(request);

      const matchKey =
        String(request.data?.matchKey || "")
            .trim()
            .slice(0, 80);

      const date =
        String(request.data?.date || "")
            .trim()
            .slice(0, 20);

      const time =
        String(request.data?.time || "")
            .trim()
            .slice(0, 10);

      if (!matchKey || !date || !time) {
        throw new HttpsError(
            "invalid-argument",
            "Data e horário são obrigatórios.",
        );
      }

      const rawScorers =
        Array.isArray(
            request.data?.scorers,
        ) ?
          request.data.scorers :
          [];

      const rawGoalkeepers =
        Array.isArray(
            request.data?.goalkeepers,
        ) ?
          request.data.goalkeepers :
          [];

      if (
        rawScorers.length > 60 ||
        rawGoalkeepers.length > 20
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Quantidade de lançamentos inválida.",
        );
      }

      const scorerMap = new Map();

      rawScorers.forEach((item) => {
        const playerId =
          String(item?.playerId || "")
              .trim()
              .slice(0, 128);

        if (!playerId) return;

        const goals =
          Math.max(
              0,
              Math.min(
                  99,
                  Math.floor(
                      Number(item?.goals) ||
                      0,
                  ),
              ),
          );

        if (!scorerMap.has(playerId)) {
          scorerMap.set(playerId, {
            playerId,
            name:
              safeRankingName(item?.name),
            goals: 0,
          });
        }

        scorerMap.get(playerId).goals +=
          goals;
      });

      const goalkeeperMap =
        new Map();

      rawGoalkeepers.forEach((item) => {
        const playerId =
          String(item?.playerId || "")
              .trim()
              .slice(0, 128);

        if (!playerId) return;

        goalkeeperMap.set(playerId, {
          playerId,
          name:
            safeRankingName(item?.name),
          goalsConceded:
            Math.max(
                0,
                Math.min(
                    99,
                    Math.floor(
                        Number(
                            item?.goalsConceded,
                        ) || 0,
                    ),
                ),
            ),
        });
      });

      const scorers =
        Array.from(scorerMap.values());

      const goalkeepers =
        Array.from(
            goalkeeperMap.values(),
        );

      if (
        scorers.length === 0 &&
        goalkeepers.length === 0
      ) {
        throw new HttpsError(
            "invalid-argument",
            "Informe pelo menos um jogador.",
        );
      }

      const db = getFirestore();

      const playerIds =
        [
          ...new Set(
              [
                ...scorers.map(
                    (item) => item.playerId,
                ),
                ...goalkeepers.map(
                    (item) => item.playerId,
                ),
              ],
          ),
        ];

      const validNames = new Map();

      for (const playerId of playerIds) {
        const playerSnapshot =
          await db
              .collection("players")
              .doc(playerId)
              .get();

        if (!playerSnapshot.exists) {
          throw new HttpsError(
              "invalid-argument",
              "Um dos jogadores não existe.",
          );
        }

        validNames.set(
            playerId,
            safeRankingName(
                playerSnapshot.data()?.name,
            ),
        );
      }

      const finalScorers =
        scorers.map((item) => ({
          playerId: item.playerId,
          name:
            validNames.get(item.playerId),
          goals: item.goals,
        }));

      const finalGoalkeepers =
        goalkeepers.map((item) => ({
          playerId: item.playerId,
          name:
            validNames.get(item.playerId),
          goalsConceded:
            item.goalsConceded,
        }));

      await db
          .collection("ranking_rounds")
          .doc(matchKey)
          .set(
              {
                matchKey,
                date,
                time,
                scorers: finalScorers,
                goalkeepers:
                  finalGoalkeepers,
                updatedBy:
                  request.auth.uid,
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              {merge: false},
          );

      const ranking =
        await recomputeRankingGreenPark(
            db,
        );

      return {
        ok: true,
        scorers: ranking.scorers,
        goalkeepers:
          ranking.goalkeepers,
      };
    },
);


exports.obterRanking = onCall(
    {
      region: "southamerica-east1",
      timeoutSeconds: 15,
    },
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "É necessário estar autenticado.",
        );
      }

      const db = getFirestore();

      const snapshot =
        await db
            .collection("ranking")
            .doc("current")
            .get();

      if (!snapshot.exists) {
        return {
          scorers: [],
          goalkeepers: [],
        };
      }

      const data = snapshot.data() || {};

      return {
        scorers:
          Array.isArray(data.scorers) ?
            data.scorers :
            [],
        goalkeepers:
          Array.isArray(data.goalkeepers) ?
            data.goalkeepers :
            [],
      };
    },
);
