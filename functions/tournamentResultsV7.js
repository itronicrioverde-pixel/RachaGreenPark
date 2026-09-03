"use strict";

const {
  onCall,
  HttpsError,
} = require(
    "firebase-functions/v2/https"
);

const {
  getFirestore,
  FieldValue,
} = require(
    "firebase-admin/firestore"
);


const ADMIN_UID =
  "d3nVt6SbQlO6lYnOcCUDbLBhoU02";


const CALL_OPTIONS = {
  invoker: "public",
  region: "southamerica-east1",
  timeoutSeconds: 30,
};


function authOrThrow(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "É necessário estar autenticado."
    );
  }
}


function adminOrThrow(request) {
  authOrThrow(request);

  if (
    request.auth.uid !==
    ADMIN_UID
  ) {
    throw new HttpsError(
      "permission-denied",
      "Apenas o administrador pode lançar resultados."
    );
  }
}


function safeString(
  value,
  max = 120
) {
  return String(value || "")
    .trim()
    .slice(0, max);
}


function safeId(value) {
  const id =
    safeString(
      value,
      128
    );

  if (
    !id ||
    id.includes("/")
  ) {
    return "";
  }

  return id;
}


function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0 ||
    number > 99
  ) {
    return null;
  }

  return number;
}


function scoreOrThrow(
  value,
  label
) {
  const number =
    numberOrNull(value);

  if (number === null) {
    throw new HttpsError(
      "invalid-argument",
      label +
      " deve ser um número de 0 a 99."
    );
  }

  return number;
}


async function currentTournamentOrThrow(
  db,
  rawTournamentId
) {
  const tournamentId =
    safeId(
      rawTournamentId
    );

  if (!tournamentId) {
    throw new HttpsError(
      "invalid-argument",
      "Campeonato inválido."
    );
  }

  const currentSnapshot =
    await db
      .collection(
        "tournament_settings"
      )
      .doc("current")
      .get();

  const currentId =
    currentSnapshot.exists ?
      safeId(
        currentSnapshot
          .data()
          ?.currentTournamentId
      ) :
      "";

  if (
    !currentId ||
    currentId !== tournamentId
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Atualize a tela do campeonato."
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
      "Campeonato não encontrado."
    );
  }

  return {
    tournamentId,
    tournamentRef,
  };
}


function teamFromSnapshot(snapshot) {
  const data =
    snapshot.data() || {};

  return {
    id:
      snapshot.id,

    name:
      safeString(
        data.name,
        60
      ),

    groupId:
      safeString(
        data.groupId,
        4
      ),

    groupOrder:
      Number(
        data.groupOrder ||
        0
      ),
  };
}


function matchFromSnapshot(snapshot) {
  const data =
    snapshot.data() || {};

  return {
    id:
      snapshot.id,

    stage:
      safeString(
        data.stage,
        30
      ),

    stageLabel:
      safeString(
        data.stageLabel,
        50
      ),

    groupId:
      safeString(
        data.groupId,
        4
      ),

    order:
      Number(
        data.order ||
        0
      ),

    homeTeamId:
      safeId(
        data.homeTeamId
      ),

    awayTeamId:
      safeId(
        data.awayTeamId
      ),

    homeSource:
      safeString(
        data.homeSource,
        100
      ),

    awaySource:
      safeString(
        data.awaySource,
        100
      ),

    homeScore:
      numberOrNull(
        data.homeScore
      ),

    awayScore:
      numberOrNull(
        data.awayScore
      ),

    homePenalties:
      numberOrNull(
        data.homePenalties
      ),

    awayPenalties:
      numberOrNull(
        data.awayPenalties
      ),

    winnerTeamId:
      safeId(
        data.winnerTeamId
      ),

    status:
      safeString(
        data.status,
        20
      ) ||
      "scheduled",
  };
}


function isFinished(match) {
  return (
    match.status ===
      "finished" &&
    match.homeScore !==
      null &&
    match.awayScore !==
      null
  );
}


function matchWinnerId(match) {
  if (
    !isFinished(match) ||
    !match.homeTeamId ||
    !match.awayTeamId
  ) {
    return "";
  }

  if (
    match.homeScore >
    match.awayScore
  ) {
    return match.homeTeamId;
  }

  if (
    match.awayScore >
    match.homeScore
  ) {
    return match.awayTeamId;
  }

  if (
    match.homePenalties !==
      null &&
    match.awayPenalties !==
      null
  ) {
    if (
      match.homePenalties >
      match.awayPenalties
    ) {
      return match.homeTeamId;
    }

    if (
      match.awayPenalties >
      match.homePenalties
    ) {
      return match.awayTeamId;
    }
  }

  return "";
}


function buildRankings(
  teams,
  matches
) {
  const groups =
    new Map();

  teams.forEach((team) => {
    const groupId =
      safeString(
        team.groupId,
        4
      ) || "U";

    if (!groups.has(groupId)) {
      groups.set(
        groupId,
        new Map()
      );
    }

    groups
      .get(groupId)
      .set(
        team.id,
        {
          teamId:
            team.id,

          name:
            team.name,

          groupOrder:
            Number(
              team.groupOrder ||
              0
            ),

          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDiff: 0,
          points: 0,
        }
      );
  });


  matches
    .filter(
      (match) =>
        match.stage ===
          "group" &&
        isFinished(match)
    )
    .forEach((match) => {
      const group =
        groups.get(
          match.groupId ||
          "U"
        );

      if (!group) {
        return;
      }

      const home =
        group.get(
          match.homeTeamId
        );

      const away =
        group.get(
          match.awayTeamId
        );

      if (
        !home ||
        !away
      ) {
        return;
      }

      home.played += 1;
      away.played += 1;

      home.goalsFor +=
        match.homeScore;

      home.goalsAgainst +=
        match.awayScore;

      away.goalsFor +=
        match.awayScore;

      away.goalsAgainst +=
        match.homeScore;

      if (
        match.homeScore >
        match.awayScore
      ) {
        home.wins += 1;
        home.points += 3;
        away.losses += 1;

      } else if (
        match.awayScore >
        match.homeScore
      ) {
        away.wins += 1;
        away.points += 3;
        home.losses += 1;

      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += 1;
        away.points += 1;
      }
    });


  const rankings =
    new Map();

  groups.forEach(
    (group, groupId) => {
      const rows =
        Array.from(
          group.values()
        );

      rows.forEach((row) => {
        row.goalDiff =
          row.goalsFor -
          row.goalsAgainst;
      });

      rows.sort((a, b) => {
        return (
          b.points -
            a.points ||

          b.wins -
            a.wins ||

          b.goalDiff -
            a.goalDiff ||

          b.goalsFor -
            a.goalsFor ||

          a.goalsAgainst -
            b.goalsAgainst ||

          a.groupOrder -
            b.groupOrder ||

          a.name.localeCompare(
            b.name,
            "pt-BR",
            {
              sensitivity:
                "base",
            }
          )
        );
      });

      rankings.set(
        groupId,
        rows
      );
    }
  );

  return rankings;
}


function groupFinished(
  groupId,
  matches
) {
  const groupMatches =
    matches.filter(
      (match) =>
        match.stage ===
          "group" &&
        (
          match.groupId ||
          "U"
        ) === groupId
    );

  return (
    groupMatches.length >
      0 &&
    groupMatches.every(
      isFinished
    )
  );
}


function resolveSource(
  source,
  rankings,
  matches
) {
  const clean =
    safeString(
      source,
      100
    )
      .toLocaleUpperCase(
        "pt-BR"
      );

  if (!clean) {
    return "";
  }

  const groupMatch =
    clean.match(
      /^(\d+)º GRUPO (ÚNICO|[A-Z])$/u
    );

  if (groupMatch) {
    const position =
      Number(
        groupMatch[1]
      );

    const groupId =
      groupMatch[2] ===
        "ÚNICO" ?
        "U" :
        groupMatch[2];

    if (
      !groupFinished(
        groupId,
        matches
      )
    ) {
      return "";
    }

    const ranking =
      rankings.get(
        groupId
      ) || [];

    return safeId(
      ranking[
        position - 1
      ]?.teamId
    );
  }


  const prefix =
    "VENCEDOR ";

  if (
    clean.startsWith(
      prefix
    )
  ) {
    const wanted =
      clean
        .slice(
          prefix.length
        )
        .trim();

    const sourceMatch =
      matches.find(
        (match) =>
          String(
            match.stageLabel ||
            ""
          )
            .toLocaleUpperCase(
              "pt-BR"
            ) ===
          wanted
      );

    if (!sourceMatch) {
      return "";
    }

    return (
      safeId(
        sourceMatch
          .winnerTeamId
      ) ||
      matchWinnerId(
        sourceMatch
      )
    );
  }

  return "";
}


function mergePatch(
  patches,
  matchId,
  values
) {
  const current =
    patches.get(
      matchId
    ) || {};

  patches.set(
    matchId,
    {
      ...current,
      ...values,
    }
  );
}


function clearResultInMemory(match) {
  match.homeScore =
    null;

  match.awayScore =
    null;

  match.homePenalties =
    null;

  match.awayPenalties =
    null;

  match.winnerTeamId =
    "";

  match.status =
    "scheduled";
}


function recomputeKnockout(
  teams,
  matches,
  patches
) {
  const rankings =
    buildRankings(
      teams,
      matches
    );

  const knockout =
    matches
      .filter(
        (match) =>
          match.stage !==
          "group"
      )
      .sort(
        (a, b) =>
          a.order -
          b.order
      );


  knockout.forEach((match) => {
    const desiredHome =
      resolveSource(
        match.homeSource,
        rankings,
        matches
      );

    const desiredAway =
      resolveSource(
        match.awaySource,
        rankings,
        matches
      );


    const changed =
      match.homeTeamId !==
        desiredHome ||
      match.awayTeamId !==
        desiredAway;


    if (changed) {
      match.homeTeamId =
        desiredHome;

      match.awayTeamId =
        desiredAway;

      clearResultInMemory(
        match
      );

      mergePatch(
        patches,
        match.id,
        {
          homeTeamId:
            desiredHome,

          awayTeamId:
            desiredAway,

          homeScore:
            null,

          awayScore:
            null,

          homePenalties:
            null,

          awayPenalties:
            null,

          winnerTeamId:
            "",

          status:
            "scheduled",
        }
      );
    }


    if (
      !match.homeTeamId ||
      !match.awayTeamId
    ) {
      if (
        isFinished(match) ||
        match.winnerTeamId
      ) {
        clearResultInMemory(
          match
        );

        mergePatch(
          patches,
          match.id,
          {
            homeScore:
              null,

            awayScore:
              null,

            homePenalties:
              null,

            awayPenalties:
              null,

            winnerTeamId:
              "",

            status:
              "scheduled",
          }
        );
      }

      return;
    }


    const winner =
      matchWinnerId(
        match
      );

    if (
      match.winnerTeamId !==
      winner
    ) {
      match.winnerTeamId =
        winner;

      mergePatch(
        patches,
        match.id,
        {
          winnerTeamId:
            winner,
        }
      );
    }
  });
}


async function readTournamentData(
  context
) {
  const [
    teamsSnapshot,
    matchesSnapshot,
  ] =
    await Promise.all([
      context
        .tournamentRef
        .collection("teams")
        .get(),

      context
        .tournamentRef
        .collection("matches")
        .get(),
    ]);

  return {
    teams:
      teamsSnapshot.docs
        .map(
          teamFromSnapshot
        ),

    matches:
      matchesSnapshot.docs
        .map(
          matchFromSnapshot
        ),
  };
}


async function commitPatches(
  context,
  patches,
  uid
) {
  const db =
    getFirestore();

  const batch =
    db.batch();

  const matchesRef =
    context
      .tournamentRef
      .collection("matches");

  patches.forEach(
    (values, matchId) => {
      batch.set(
        matchesRef.doc(
          matchId
        ),
        {
          ...values,

          updatedBy:
            uid,

          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        {
          merge: true,
        }
      );
    }
  );

  await batch.commit();
}


exports.salvarResultadoJogoTorneio =
onCall(
  CALL_OPTIONS,
  async (request) => {
    adminOrThrow(request);

    const db =
      getFirestore();

    const context =
      await currentTournamentOrThrow(
        db,
        request.data
          ?.tournamentId
      );

    const matchId =
      safeId(
        request.data
          ?.matchId
      );

    if (!matchId) {
      throw new HttpsError(
        "invalid-argument",
        "Jogo inválido."
      );
    }

    const {
      teams,
      matches,
    } =
      await readTournamentData(
        context
      );

    const match =
      matches.find(
        (item) =>
          item.id ===
          matchId
      );

    if (!match) {
      throw new HttpsError(
        "not-found",
        "Jogo não encontrado."
      );
    }

    if (
      !match.homeTeamId ||
      !match.awayTeamId
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Este confronto ainda não está definido."
      );
    }

    const homeScore =
      scoreOrThrow(
        request.data
          ?.homeScore,
        "Placar da primeira equipe"
      );

    const awayScore =
      scoreOrThrow(
        request.data
          ?.awayScore,
        "Placar da segunda equipe"
      );

    let homePenalties =
      null;

    let awayPenalties =
      null;


    if (
      match.stage !==
        "group" &&
      homeScore ===
        awayScore
    ) {
      homePenalties =
        scoreOrThrow(
          request.data
            ?.homePenalties,
          "Pênaltis da primeira equipe"
        );

      awayPenalties =
        scoreOrThrow(
          request.data
            ?.awayPenalties,
          "Pênaltis da segunda equipe"
        );

      if (
        homePenalties ===
        awayPenalties
      ) {
        throw new HttpsError(
          "invalid-argument",
          "Nos pênaltis precisa haver um vencedor."
        );
      }
    }


    match.homeScore =
      homeScore;

    match.awayScore =
      awayScore;

    match.homePenalties =
      homePenalties;

    match.awayPenalties =
      awayPenalties;

    match.status =
      "finished";

    match.winnerTeamId =
      matchWinnerId(
        match
      );


    const patches =
      new Map();

    mergePatch(
      patches,
      match.id,
      {
        homeScore,

        awayScore,

        homePenalties,

        awayPenalties,

        winnerTeamId:
          match.winnerTeamId,

        status:
          "finished",

        resultUpdatedAt:
          FieldValue
            .serverTimestamp(),
      }
    );


    recomputeKnockout(
      teams,
      matches,
      patches
    );


    await commitPatches(
      context,
      patches,
      request.auth.uid
    );


    return {
      ok: true,

      matchId,

      winnerTeamId:
        match.winnerTeamId,
    };
  }
);


exports.limparResultadoJogoTorneio =
onCall(
  CALL_OPTIONS,
  async (request) => {
    adminOrThrow(request);

    const db =
      getFirestore();

    const context =
      await currentTournamentOrThrow(
        db,
        request.data
          ?.tournamentId
      );

    const matchId =
      safeId(
        request.data
          ?.matchId
      );

    if (!matchId) {
      throw new HttpsError(
        "invalid-argument",
        "Jogo inválido."
      );
    }

    const {
      teams,
      matches,
    } =
      await readTournamentData(
        context
      );

    const match =
      matches.find(
        (item) =>
          item.id ===
          matchId
      );

    if (!match) {
      throw new HttpsError(
        "not-found",
        "Jogo não encontrado."
      );
    }


    clearResultInMemory(
      match
    );


    const patches =
      new Map();

    mergePatch(
      patches,
      match.id,
      {
        homeScore:
          null,

        awayScore:
          null,

        homePenalties:
          null,

        awayPenalties:
          null,

        winnerTeamId:
          "",

        status:
          "scheduled",

        resultUpdatedAt:
          FieldValue
            .serverTimestamp(),
      }
    );


    recomputeKnockout(
      teams,
      matches,
      patches
    );


    await commitPatches(
      context,
      patches,
      request.auth.uid
    );


    return {
      ok: true,
      matchId,
    };
  }
);
