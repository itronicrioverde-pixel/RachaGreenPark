"use strict";

const {
  onCall,
  HttpsError,
} = require("firebase-functions/v2/https");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");


const ADMIN_UID =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";

const CALL_OPTIONS = {
  invoker: "public",
  region: "southamerica-east1",
  timeoutSeconds: 20,
};


function authOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError(
        "unauthenticated",
        "É necessário estar autenticado.",
    );
  }
}


function adminOrThrow(request) {
  authOrThrow(request);

  if (request.auth.uid !== ADMIN_UID) {
    throw new HttpsError(
        "permission-denied",
        "Apenas o administrador pode alterar o campeonato.",
    );
  }
}


function safeId(value) {
  const id =
    String(value || "")
        .trim()
        .slice(0, 128);

  if (
    !id ||
    id.includes("/")
  ) {
    return "";
  }

  return id;
}


function normalizeTeamsCount(value) {
  const count =
    Number(value);

  if (
    !Number.isInteger(count) ||
    count < 8 ||
    count > 32
  ) {
    throw new HttpsError(
        "invalid-argument",
        "A quantidade deve ser entre 8 e 32 equipes.",
    );
  }

  return count;
}


async function currentTournament(
    db,
    rawTournamentId,
) {
  const tournamentId =
    safeId(rawTournamentId);

  if (!tournamentId) {
    throw new HttpsError(
        "invalid-argument",
        "Campeonato inválido.",
    );
  }

  const settings =
    await db
        .collection("tournament_settings")
        .doc("current")
        .get();

  const currentId =
    settings.exists ?
      safeId(
          settings
              .data()
              ?.currentTournamentId,
      ) :
      "";

  if (
    !currentId ||
    currentId !== tournamentId
  ) {
    throw new HttpsError(
        "failed-precondition",
        "Atualize a tela do campeonato.",
    );
  }

  const tournamentRef =
    db
        .collection("tournaments")
        .doc(tournamentId);

  const tournamentSnapshot =
    await tournamentRef.get();

  if (!tournamentSnapshot.exists) {
    throw new HttpsError(
        "not-found",
        "Campeonato não encontrado.",
    );
  }

  return {
    tournamentId,
    tournamentRef,
    tournamentData:
      tournamentSnapshot.data() || {},
  };
}


async function readConfig(
    context,
) {
  const configRef =
    context
        .tournamentRef
        .collection("settings")
        .doc("format");

  const snapshot =
    await configRef.get();

  const data =
    snapshot.exists ?
      snapshot.data() || {} :
      {};

  const parentDefault =
    Number(
        context
            .tournamentData
            ?.teamsCount,
    );

  let teamsCount =
    Number(data.teamsCount);

  if (
    !Number.isInteger(teamsCount) ||
    teamsCount < 8 ||
    teamsCount > 32
  ) {
    teamsCount =
      Number.isInteger(parentDefault) &&
      parentDefault >= 8 &&
      parentDefault <= 32 ?
        parentDefault :
        10;
  }

  const groupA =
    Math.ceil(
        teamsCount / 2,
    );

  const groupB =
    Math.floor(
        teamsCount / 2,
    );

  return {
    teamsCount,
    groupCount: 2,
    groupA,
    groupB,
    qualifyPerGroup: 4,
  };
}


exports.obterConfiguracaoEquipesTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      authOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournament(
            db,
            request.data?.tournamentId,
        );

      const config =
        await readConfig(context);

      return {
        ok: true,
        ...config,
      };
    },
);


exports.salvarQuantidadeEquipesTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournament(
            db,
            request.data?.tournamentId,
        );

      const teamsCount =
        normalizeTeamsCount(
            request.data?.teamsCount,
        );

      const groupA =
        Math.ceil(
            teamsCount / 2,
        );

      const groupB =
        Math.floor(
            teamsCount / 2,
        );

      const configRef =
        context
            .tournamentRef
            .collection("settings")
            .doc("format");

      await configRef.set(
          {
            teamsCount,
            groupCount: 2,
            groupA,
            groupB,
            qualifyPerGroup: 4,
            updatedBy:
              request.auth.uid,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {merge: true},
      );

      return {
        ok: true,
        teamsCount,
        groupCount: 2,
        groupA,
        groupB,
        qualifyPerGroup: 4,
      };
    },
);
