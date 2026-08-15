/*
 * GREEN PARK FC — Estatísticas Ao Vivo + Ranking
 * Anexar ao final de functions/index.js.
 */

const GREEN_PARK_ADMIN_UID_LIVE_STATS =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";

function liveStatsAuthOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
}

function liveStatsAdminOrThrow(request) {
  liveStatsAuthOrThrow(request);

  if (request.auth.uid !== GREEN_PARK_ADMIN_UID_LIVE_STATS) {
    throw new HttpsError("permission-denied", "Apenas o administrador pode alterar as estatísticas.");
  }
}

function safeLiveName(value) {
  return String(value || "Jogador").trim().slice(0, 60);
}

function safeMatchKey(value) {
  return String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 90);
}

function liveStatDocId(matchKey, playerId) {
  return matchKey + "__" +
    String(playerId || "")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 128);
}

async function getConfirmedPlayerOrThrow(db, playerId) {
  const ref = db.collection("players").doc(playerId);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Jogador não encontrado.");
  }

  const data = snapshot.data() || {};

  if (data.status !== "confirmed") {
    throw new HttpsError("failed-precondition", "Esse jogador não está confirmado.");
  }

  return {ref, data};
}

async function recomputeLiveRanking(db) {
  const snapshot = await db.collection("match_stats").get();
  const playerMap = new Map();

  function getEntry(playerId, name, photoURL) {
    if (!playerMap.has(playerId)) {
      playerMap.set(playerId, {
        playerId,
        name: safeLiveName(name),
        photoURL: String(photoURL || "").slice(0, 2000),
        goals: 0,
        goalkeeperGames: 0,
        goalsConceded: 0,
      });
    }

    const entry = playerMap.get(playerId);

    if (name) entry.name = safeLiveName(name);
    if (photoURL) entry.photoURL = String(photoURL).slice(0, 2000);

    return entry;
  }

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const playerId = String(data.playerId || "").trim();
    if (!playerId) return;

    const entry = getEntry(playerId, data.name, data.photoURL);

    entry.goals += Math.max(0, Math.floor(Number(data.goals) || 0));

    if (data.isGoalkeeper === true) {
      entry.goalkeeperGames += 1;
      entry.goalsConceded += Math.max(
          0,
          Math.floor(Number(data.goalsConceded) || 0),
      );
    }
  });

  const players = Array.from(playerMap.values());

  const scorers = players
      .filter((item) => item.goals > 0)
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => ({
        playerId: item.playerId,
        name: item.name,
        photoURL: item.photoURL || "",
        goals: item.goals,
      }));

  const goalkeepers = players
      .filter((item) => item.goalkeeperGames >= 3)
      .map((item) => ({
        playerId: item.playerId,
        name: item.name,
        photoURL: item.photoURL || "",
        games: item.goalkeeperGames,
        goalsConceded: item.goalsConceded,
        average: item.goalkeeperGames > 0 ?
          item.goalsConceded / item.goalkeeperGames :
          0,
        balance: item.goals - item.goalsConceded,
      }))
      .sort((a, b) =>
        a.average - b.average ||
        a.goalsConceded - b.goalsConceded ||
        b.games - a.games ||
        a.name.localeCompare(b.name, "pt-BR"),
      );

  await db.collection("ranking").doc("current").set(
      {
        scorers,
        goalkeepers,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true},
  );

  return {scorers, goalkeepers};
}

exports.listarConfirmados = onCall(
    {region: "southamerica-east1", timeoutSeconds: 15},
    async (request) => {
      liveStatsAuthOrThrow(request);

      const db = getFirestore();
      const snapshot = await db
          .collection("players")
          .where("status", "==", "confirmed")
          .get();

      const players = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        let confirmedAt = 0;

        if (data.confirmedAt && typeof data.confirmedAt.toMillis === "function") {
          confirmedAt = data.confirmedAt.toMillis();
        }

        return {
          id: docSnap.id,
          name: safeLiveName(data.name),
          photoURL: String(data.photoURL || "").slice(0, 2000),
          confirmedAt,
        };
      });

      players.sort((a, b) =>
        (a.confirmedAt && b.confirmedAt) ?
          a.confirmedAt - b.confirmedAt :
          a.name.localeCompare(b.name, "pt-BR"),
      );

      return {count: players.length, players: players.slice(0, 100)};
    },
);

exports.obterEstatisticasRacha = onCall(
    {region: "southamerica-east1", timeoutSeconds: 20},
    async (request) => {
      liveStatsAuthOrThrow(request);

      const matchKey = safeMatchKey(request.data?.matchKey);

      if (!matchKey) {
        throw new HttpsError("invalid-argument", "Racha inválido.");
      }

      const db = getFirestore();

      const [playersSnapshot, statsSnapshot] = await Promise.all([
        db.collection("players").where("status", "==", "confirmed").get(),
        db.collection("match_stats").where("matchKey", "==", matchKey).get(),
      ]);

      const statsMap = new Map();

      statsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() || {};
        statsMap.set(String(data.playerId || ""), data);
      });

      const players = playersSnapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        const stat = statsMap.get(docSnap.id) || {};

        return {
          playerId: docSnap.id,
          name: safeLiveName(data.name),
          photoURL: String(data.photoURL || "").slice(0, 2000),
          goals: Math.max(0, Math.floor(Number(stat.goals) || 0)),
          goalsConceded: Math.max(0, Math.floor(Number(stat.goalsConceded) || 0)),
          isGoalkeeper: stat.isGoalkeeper === true,
        };
      });

      players.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

      return {matchKey, players};
    },
);

exports.alterarEstatisticaJogador = onCall(
    {region: "southamerica-east1", timeoutSeconds: 30},
    async (request) => {
      liveStatsAdminOrThrow(request);

      const matchKey = safeMatchKey(request.data?.matchKey);
      const playerId = String(request.data?.playerId || "").trim().slice(0, 128);
      const field = String(request.data?.field || "");
      const delta = Number(request.data?.delta);
      const date = String(request.data?.date || "").trim().slice(0, 20);
      const time = String(request.data?.time || "").trim().slice(0, 10);

      if (
        !matchKey ||
        !playerId ||
        !["goals", "goalsConceded"].includes(field) ||
        ![-1, 1].includes(delta)
      ) {
        throw new HttpsError("invalid-argument", "Alteração inválida.");
      }

      const db = getFirestore();
      const player = await getConfirmedPlayerOrThrow(db, playerId);
      const playerData = player.data || {};

      const statRef = db.collection("match_stats").doc(
          liveStatDocId(matchKey, playerId),
      );

      const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(statRef);
        const current = snapshot.exists ? snapshot.data() || {} : {};

        let goals = Math.max(0, Math.floor(Number(current.goals) || 0));
        let goalsConceded = Math.max(
            0,
            Math.floor(Number(current.goalsConceded) || 0),
        );
        let isGoalkeeper = current.isGoalkeeper === true;

        if (field === "goals") {
          goals = Math.max(0, goals + delta);
        }

        if (field === "goalsConceded") {
          if (!isGoalkeeper && delta > 0) {
            isGoalkeeper = true;
          }

          if (!isGoalkeeper) {
            throw new HttpsError(
                "failed-precondition",
                "Marque o jogador como goleiro primeiro.",
            );
          }

          goalsConceded = Math.max(0, goalsConceded + delta);
        }

        const value = {
          matchKey,
          date,
          time,
          playerId,
          name: safeLiveName(playerData.name),
          photoURL: String(playerData.photoURL || "").slice(0, 2000),
          goals,
          goalsConceded,
          isGoalkeeper,
          updatedBy: request.auth.uid,
          updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.set(statRef, value, {merge: true});
        return value;
      });

      await recomputeLiveRanking(db);

      return {
        ok: true,
        player: {
          playerId,
          goals: result.goals,
          goalsConceded: result.goalsConceded,
          isGoalkeeper: result.isGoalkeeper,
        },
      };
    },
);

exports.marcarGoleiroRacha = onCall(
    {region: "southamerica-east1", timeoutSeconds: 30},
    async (request) => {
      liveStatsAdminOrThrow(request);

      const matchKey = safeMatchKey(request.data?.matchKey);
      const playerId = String(request.data?.playerId || "").trim().slice(0, 128);
      const isGoalkeeper = request.data?.isGoalkeeper === true;
      const date = String(request.data?.date || "").trim().slice(0, 20);
      const time = String(request.data?.time || "").trim().slice(0, 10);

      if (!matchKey || !playerId) {
        throw new HttpsError("invalid-argument", "Jogador ou racha inválido.");
      }

      const db = getFirestore();
      const player = await getConfirmedPlayerOrThrow(db, playerId);
      const playerData = player.data || {};

      const statRef = db.collection("match_stats").doc(
          liveStatDocId(matchKey, playerId),
      );

      const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(statRef);
        const current = snapshot.exists ? snapshot.data() || {} : {};

        const goals = Math.max(0, Math.floor(Number(current.goals) || 0));
        const goalsConceded = isGoalkeeper ?
          Math.max(0, Math.floor(Number(current.goalsConceded) || 0)) :
          0;

        const value = {
          matchKey,
          date,
          time,
          playerId,
          name: safeLiveName(playerData.name),
          photoURL: String(playerData.photoURL || "").slice(0, 2000),
          goals,
          goalsConceded,
          isGoalkeeper,
          updatedBy: request.auth.uid,
          updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.set(statRef, value, {merge: true});
        return value;
      });

      await recomputeLiveRanking(db);

      return {
        ok: true,
        player: {
          playerId,
          goals: result.goals,
          goalsConceded: result.goalsConceded,
          isGoalkeeper: result.isGoalkeeper,
        },
      };
    },
);

exports.obterRanking = onCall(
    {region: "southamerica-east1", timeoutSeconds: 15},
    async (request) => {
      liveStatsAuthOrThrow(request);

      const db = getFirestore();
      const snapshot = await db.collection("ranking").doc("current").get();

      if (!snapshot.exists) {
        return {scorers: [], goalkeepers: []};
      }

      const data = snapshot.data() || {};

      return {
        scorers: Array.isArray(data.scorers) ? data.scorers : [],
        goalkeepers: Array.isArray(data.goalkeepers) ? data.goalkeepers : [],
      };
    },
);

// Compatibilidade: formulário antigo fica desativado no novo index.
exports.carregarRankingRacha = onCall(
    {region: "southamerica-east1", timeoutSeconds: 15},
    async (request) => {
      liveStatsAdminOrThrow(request);
      return {exists: false, scorers: [], goalkeepers: []};
    },
);

exports.salvarRankingRacha = onCall(
    {region: "southamerica-east1", timeoutSeconds: 15},
    async (request) => {
      liveStatsAdminOrThrow(request);
      throw new HttpsError(
          "failed-precondition",
          "Use a página Estatísticas para lançar os gols durante o racha.",
      );
    },
);
