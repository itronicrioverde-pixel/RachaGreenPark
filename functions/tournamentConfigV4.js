// GREEN PARK TOURNAMENT MIN THREE V47
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
    count < 3 ||
    count > 32
  ) {
    throw new HttpsError(
        "invalid-argument",
        "A quantidade deve ser entre 3 e 32 equipes.",
    );
  }

  return count;
}



// GREEN PARK TOURNAMENT COUNT SYNC V62

function adaptiveTeamsConfig(
    teamsCount,
) {
  let groupCount = 1;
  let qualifyPerGroup = 2;
  let formatKey = "single-final";
  let formatLabel =
    "Grupo único + final";

  if (teamsCount === 5) {
    groupCount = 1;
    qualifyPerGroup = 4;
    formatKey = "single-semis";
    formatLabel =
      "Grupo único + semifinais + final";
  } else if (teamsCount <= 10) {
    groupCount = 2;
    qualifyPerGroup = 2;
    formatKey = "two-semis";
    formatLabel =
      "2 grupos + semifinais + final";
  } else if (teamsCount <= 16) {
    groupCount = 2;
    qualifyPerGroup = 4;
    formatKey = "two-quarters";
    formatLabel =
      "2 grupos + quartas + final";
  } else {
    groupCount = 4;
    qualifyPerGroup = 2;
    formatKey = "four-quarters";
    formatLabel =
      "4 grupos + quartas + final";
  }

  const base =
    Math.floor(
        teamsCount / groupCount,
    );

  const extra =
    teamsCount % groupCount;

  const sizes =
    Array.from(
        {
          length: groupCount,
        },
        (_, index) =>
          base +
          (
            index < extra ?
              1 :
              0
          ),
    );

  return {
    teamsCount,
    groupCount,

    teamsPerGroup:
      Math.max(
          ...sizes,
      ),

    groupA:
      sizes[0] || 0,

    groupB:
      sizes[1] || 0,

    groupC:
      sizes[2] || 0,

    groupD:
      sizes[3] || 0,

    qualifyPerGroup,
    formatKey,
    formatLabel,
  };
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
    teamsCount < 3 ||
    teamsCount > 32
  ) {
    teamsCount =
      Number.isInteger(parentDefault) &&
      parentDefault >= 3 &&
      parentDefault <= 32 ?
        parentDefault :
        10;
  }

  return adaptiveTeamsConfig(
      teamsCount,
  );
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

      const config =
        adaptiveTeamsConfig(
            teamsCount,
        );

      const configRef =
        context
            .tournamentRef
            .collection("settings")
            .doc("format");

      const batch =
        db.batch();

      batch.set(
          configRef,
          {
            ...config,

            updatedBy:
              request.auth.uid,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          },
      );

      batch.set(
          context.tournamentRef,
          {
            ...config,

            teamFormatUpdatedBy:
              request.auth.uid,

            teamFormatUpdatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          },
      );

      await batch.commit();

      return {
        ok: true,
        ...config,
      };
    },
);
