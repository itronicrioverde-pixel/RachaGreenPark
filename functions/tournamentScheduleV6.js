"use strict";

const crypto =
  require("crypto");

const {
  onCall,
  HttpsError,
} =
  require(
      "firebase-functions/v2/https",
  );

const {
  getFirestore,
  FieldValue,
} =
  require(
      "firebase-admin/firestore",
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
        "É necessário estar autenticado.",
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
        "Apenas o administrador pode gerar os jogos.",
    );
  }
}


function safeString(
    value,
    max = 120,
) {
  return String(value || "")
      .trim()
      .slice(0, max);
}


function safeId(value) {
  const id =
    safeString(
        value,
        128,
    );

  if (
    !id ||
    id.includes("/")
  ) {
    return "";
  }

  return id;
}


async function currentTournamentOrThrow(
    db,
    rawTournamentId,
) {
  const tournamentId =
    safeId(
        rawTournamentId,
    );

  if (!tournamentId) {
    throw new HttpsError(
        "invalid-argument",
        "Campeonato inválido.",
    );
  }

  const settings =
    await db
        .collection(
            "tournament_settings",
        )
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

  const snapshot =
    await tournamentRef.get();

  if (!snapshot.exists) {
    throw new HttpsError(
        "not-found",
        "Campeonato não encontrado.",
    );
  }

  return {
    tournamentId,
    tournamentRef,
    tournamentData:
      snapshot.data() || {},
  };
}


async function configuredTeamsCount(
    context,
) {
  const snapshot =
    await context
        .tournamentRef
        .collection("settings")
        .doc("format")
        .get();

  const data =
    snapshot.exists ?
      snapshot.data() || {} :
      {};

  let count =
    Number(
        data.teamsCount,
    );

  if (
    !Number.isInteger(count) ||
    count < 3 ||
    count > 32
  ) {
    count =
      Number(
          context
              .tournamentData
              ?.teamsCount,
      );
  }

  if (
    !Number.isInteger(count) ||
    count < 3 ||
    count > 32
  ) {
    count = 10;
  }

  return count;
}


function balancedSizes(
    total,
    groups,
) {
  const base =
    Math.floor(
        total / groups,
    );

  const extra =
    total % groups;

  return Array.from(
      {
        length: groups,
      },
      (_, index) =>
        base +
        (
          index < extra ?
            1 :
            0
        ),
  );
}


function tournamentFormat(
    teamsCount,
) {
  if (teamsCount <= 4) {
    return {
      key: "single-final",
      label:
        "Grupo único + final",
      groupCount: 1,
      groupSizes:
        [teamsCount],
      knockout:
        "final",
    };
  }

  if (teamsCount === 5) {
    return {
      key: "single-semis",
      label:
        "Grupo único + semifinais + final",
      groupCount: 1,
      groupSizes: [5],
      knockout:
        "semis",
    };
  }

  if (teamsCount <= 10) {
    return {
      key: "two-semis",
      label:
        "2 grupos + semifinais + final",
      groupCount: 2,
      groupSizes:
        balancedSizes(
            teamsCount,
            2,
        ),
      knockout:
        "semis-groups",
    };
  }

  if (teamsCount <= 16) {
    return {
      key: "two-quarters",
      label:
        "2 grupos + quartas + final",
      groupCount: 2,
      groupSizes:
        balancedSizes(
            teamsCount,
            2,
        ),
      knockout:
        "quarters-two",
    };
  }

  return {
    key: "four-quarters",
    label:
      "4 grupos + quartas + final",
    groupCount: 4,
    groupSizes:
      balancedSizes(
          teamsCount,
          4,
      ),
    knockout:
      "quarters-four",
  };
}


function shuffle(items) {
  const result =
    [...items];

  for (
    let index =
      result.length - 1;
    index > 0;
    index -= 1
  ) {
    const random =
      crypto.randomInt(
          index + 1,
      );

    [
      result[index],
      result[random],
    ] = [
      result[random],
      result[index],
    ];
  }

  return result;
}


function groupId(index) {
  return String.fromCharCode(
      65 + index,
  );
}


function groupLabel(
    id,
    count,
) {
  if (count === 1) {
    return "GRUPO ÚNICO";
  }

  return "GRUPO " + id;
}


function distributeTeams(
    teams,
    format,
) {
  const shuffled =
    shuffle(teams);

  if (
    format.groupCount === 1
  ) {
    return [
      shuffled,
    ];
  }

  const groups =
    Array.from(
        {
          length:
            format.groupCount,
        },
        () => [],
    );

  shuffled.forEach(
      (team, index) => {
        groups[
            index %
            format.groupCount
        ].push(team);
      },
  );

  return groups;
}


function generateRoundRobin(
    groupTeams,
    id,
    label,
    startOrder,
) {
  const rotating =
    [...groupTeams];

  if (
    rotating.length % 2 !== 0
  ) {
    rotating.push(null);
  }

  const totalSlots =
    rotating.length;

  const rounds =
    totalSlots - 1;

  const matches =
    [];

  let order =
    startOrder;

  for (
    let round = 0;
    round < rounds;
    round += 1
  ) {
    let matchNumber = 0;

    for (
      let index = 0;
      index <
        totalSlots / 2;
      index += 1
    ) {
      const first =
        rotating[index];

      const second =
        rotating[
            totalSlots -
            1 -
            index
        ];

      if (
        !first ||
        !second
      ) {
        continue;
      }

      matchNumber += 1;

      let home =
        first;

      let away =
        second;

      if (
        (
          round +
          index
        ) % 2 !== 0
      ) {
        home = second;
        away = first;
      }

      const matchId =
        "group_" +
        id +
        "_r" +
        String(
            round + 1,
        ).padStart(2, "0") +
        "_m" +
        String(
            matchNumber,
        ).padStart(2, "0");

      matches.push({
        id: matchId,
        stage: "group",
        stageLabel:
          label,
        groupId: id,
        groupLabel:
          label,
        round:
          round + 1,
        order,
        homeTeamId:
          home.id,
        awayTeamId:
          away.id,
        homeSource: "",
        awaySource: "",
      });

      order += 1;
    }

    const fixed =
      rotating[0];

    const last =
      rotating[
          rotating.length - 1
      ];

    const middle =
      rotating.slice(
          1,
          -1,
      );

    rotating.splice(
        0,
        rotating.length,
        fixed,
        last,
        ...middle,
    );
  }

  return {
    matches,
    nextOrder: order,
  };
}


function knockoutMatch(
    id,
    stage,
    stageLabel,
    homeSource,
    awaySource,
    order,
) {
  return {
    id,
    stage,
    stageLabel,
    groupId: "",
    groupLabel: "",
    round: 0,
    order,
    homeTeamId: "",
    awayTeamId: "",
    homeSource,
    awaySource,
  };
}


function generateKnockout(
    format,
    startOrder,
) {
  let order =
    startOrder;

  const matches = [];

  function add(
      id,
      stage,
      label,
      home,
      away,
  ) {
    matches.push(
        knockoutMatch(
            id,
            stage,
            label,
            home,
            away,
            order,
        ),
    );

    order += 1;
  }

  if (
    format.knockout ===
    "final"
  ) {
    add(
        "ko_final",
        "final",
        "FINAL",
        "1º GRUPO ÚNICO",
        "2º GRUPO ÚNICO",
    );

    return {
      matches,
      nextOrder: order,
    };
  }

  if (
    format.knockout ===
    "semis"
  ) {
    add(
        "ko_sf1",
        "semifinal",
        "SEMIFINAL 1",
        "1º GRUPO ÚNICO",
        "4º GRUPO ÚNICO",
    );

    add(
        "ko_sf2",
        "semifinal",
        "SEMIFINAL 2",
        "2º GRUPO ÚNICO",
        "3º GRUPO ÚNICO",
    );

    add(
        "ko_final",
        "final",
        "FINAL",
        "VENCEDOR SEMIFINAL 1",
        "VENCEDOR SEMIFINAL 2",
    );

    return {
      matches,
      nextOrder: order,
    };
  }

  if (
    format.knockout ===
    "semis-groups"
  ) {
    add(
        "ko_sf1",
        "semifinal",
        "SEMIFINAL 1",
        "1º GRUPO A",
        "2º GRUPO B",
    );

    add(
        "ko_sf2",
        "semifinal",
        "SEMIFINAL 2",
        "1º GRUPO B",
        "2º GRUPO A",
    );

    add(
        "ko_final",
        "final",
        "FINAL",
        "VENCEDOR SEMIFINAL 1",
        "VENCEDOR SEMIFINAL 2",
    );

    return {
      matches,
      nextOrder: order,
    };
  }

  if (
    format.knockout ===
    "quarters-two"
  ) {
    add(
        "ko_qf1",
        "quarterfinal",
        "QUARTAS 1",
        "1º GRUPO A",
        "4º GRUPO B",
    );

    add(
        "ko_qf2",
        "quarterfinal",
        "QUARTAS 2",
        "2º GRUPO A",
        "3º GRUPO B",
    );

    add(
        "ko_qf3",
        "quarterfinal",
        "QUARTAS 3",
        "1º GRUPO B",
        "4º GRUPO A",
    );

    add(
        "ko_qf4",
        "quarterfinal",
        "QUARTAS 4",
        "2º GRUPO B",
        "3º GRUPO A",
    );

    add(
        "ko_sf1",
        "semifinal",
        "SEMIFINAL 1",
        "VENCEDOR QUARTAS 1",
        "VENCEDOR QUARTAS 4",
    );

    add(
        "ko_sf2",
        "semifinal",
        "SEMIFINAL 2",
        "VENCEDOR QUARTAS 2",
        "VENCEDOR QUARTAS 3",
    );

    add(
        "ko_final",
        "final",
        "FINAL",
        "VENCEDOR SEMIFINAL 1",
        "VENCEDOR SEMIFINAL 2",
    );

    return {
      matches,
      nextOrder: order,
    };
  }

  add(
      "ko_qf1",
      "quarterfinal",
      "QUARTAS 1",
      "1º GRUPO A",
      "2º GRUPO B",
  );

  add(
      "ko_qf2",
      "quarterfinal",
      "QUARTAS 2",
      "1º GRUPO B",
      "2º GRUPO A",
  );

  add(
      "ko_qf3",
      "quarterfinal",
      "QUARTAS 3",
      "1º GRUPO C",
      "2º GRUPO D",
  );

  add(
      "ko_qf4",
      "quarterfinal",
      "QUARTAS 4",
      "1º GRUPO D",
      "2º GRUPO C",
  );

  add(
      "ko_sf1",
      "semifinal",
      "SEMIFINAL 1",
      "VENCEDOR QUARTAS 1",
      "VENCEDOR QUARTAS 3",
  );

  add(
      "ko_sf2",
      "semifinal",
      "SEMIFINAL 2",
      "VENCEDOR QUARTAS 2",
      "VENCEDOR QUARTAS 4",
  );

  add(
      "ko_final",
      "final",
      "FINAL",
      "VENCEDOR SEMIFINAL 1",
      "VENCEDOR SEMIFINAL 2",
  );

  return {
    matches,
    nextOrder: order,
  };
}


function teamPayload(snapshot) {
  const data =
    snapshot.data() || {};

  return {
    id: snapshot.id,

    name:
      safeString(
          data.name,
          40,
      ),

    logoURL:
      safeString(
          data.logoURL,
          2000,
      ),

    groupId:
      safeString(
          data.groupId,
          4,
      ),

    groupOrder:
      Number(
          data.groupOrder || 0,
      ),

    order:
      Number(
          data.order || 0,
      ),
  };
}


function matchPayload(snapshot) {
  const data =
    snapshot.data() || {};

  return {
    id:
      snapshot.id,

    stage:
      safeString(
          data.stage,
          30,
      ),

    stageLabel:
      safeString(
          data.stageLabel,
          50,
      ),

    groupId:
      safeString(
          data.groupId,
          4,
      ),

    groupLabel:
      safeString(
          data.groupLabel,
          40,
      ),

    round:
      Number(
          data.round || 0,
      ),

    order:
      Number(
          data.order || 0,
      ),

    homeTeamId:
      safeId(
          data.homeTeamId,
      ),

    awayTeamId:
      safeId(
          data.awayTeamId,
      ),

    homeSource:
      safeString(
          data.homeSource,
          80,
      ),

    awaySource:
      safeString(
          data.awaySource,
          80,
      ),

    homeScore:
      Number.isFinite(
          Number(data.homeScore),
      ) &&
      data.homeScore !== null &&
      data.homeScore !== undefined ?
        Number(data.homeScore) :
        null,

    awayScore:
      Number.isFinite(
          Number(data.awayScore),
      ) &&
      data.awayScore !== null &&
      data.awayScore !== undefined ?
        Number(data.awayScore) :
        null,

    status:
      safeString(
          data.status,
          20,
      ) ||
      "scheduled",
  };
}


function hasMatchResult(match) {
  return (
    match.homeScore !== null ||
    match.awayScore !== null ||
    match.status === "live" ||
    match.status === "finished"
  );
}


function sameIds(
    first,
    second,
) {
  const a =
    [...first]
        .map(String)
        .sort();

  const b =
    [...second]
        .map(String)
        .sort();

  return (
    JSON.stringify(a) ===
    JSON.stringify(b)
  );
}


exports.listarEstruturaTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      authOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const [
        teamsSnapshot,
        matchesSnapshot,
        scheduleSnapshot,
        teamsCount,
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

          context
              .tournamentRef
              .collection("settings")
              .doc("schedule")
              .get(),

          configuredTeamsCount(
              context,
          ),
        ]);

      const teams =
        teamsSnapshot.docs
            .map(teamPayload)
            .sort(
                (a, b) =>
                  (
                    Number(
                        a.groupOrder ||
                        0,
                    ) -
                    Number(
                        b.groupOrder ||
                        0,
                    )
                  ) ||
                  a.name.localeCompare(
                      b.name,
                      "pt-BR",
                      {
                        sensitivity:
                          "base",
                      },
                  ),
            );

      const matches =
        matchesSnapshot.docs
            .map(matchPayload)
            .sort(
                (a, b) =>
                  a.order -
                  b.order,
            );

      const schedule =
        scheduleSnapshot.exists ?
          scheduleSnapshot.data() ||
          {} :
          {};

      const format =
        tournamentFormat(
            teamsCount,
        );

      const currentIds =
        teams.map(
            (team) => team.id,
        );

      const generatedIds =
        Array.isArray(
            schedule.teamIds,
        ) ?
          schedule.teamIds :
          [];

      const generated =
        scheduleSnapshot.exists &&
        matches.length > 0;

      const stale =
        generated &&
        (
          !sameIds(
              currentIds,
              generatedIds,
          ) ||
          safeString(
              schedule.formatKey,
              50,
          ) !==
            format.key
        );

      const hasResults =
        matches.some(
            hasMatchResult,
        );

      return {
        teams,
        matches,
        teamsCount,
        format,
        generated,
        stale,
        hasResults,

        generation: {
          formatKey:
            safeString(
                schedule.formatKey,
                50,
            ),

          formatLabel:
            safeString(
                schedule.formatLabel,
                100,
            ),

          groupCount:
            Number(
                schedule.groupCount ||
                0,
            ),

          groupStageMatches:
            Number(
                schedule
                    .groupStageMatches ||
                0,
            ),

          knockoutMatches:
            Number(
                schedule
                    .knockoutMatches ||
                0,
            ),
        },
      };
    },
);


exports.gerarEstruturaTorneio =
onCall(
    CALL_OPTIONS,
    async (request) => {
      adminOrThrow(request);

      const db =
        getFirestore();

      const context =
        await currentTournamentOrThrow(
            db,
            request.data?.tournamentId,
        );

      const force =
        request.data?.force ===
        true;

      const [
        teamsSnapshot,
        oldMatchesSnapshot,
        scheduleSnapshot,
        teamsCount,
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

          context
              .tournamentRef
              .collection("settings")
              .doc("schedule")
              .get(),

          configuredTeamsCount(
              context,
          ),
        ]);

      if (
        teamsSnapshot.size !==
        teamsCount
      ) {
        throw new HttpsError(
            "failed-precondition",
            "Cadastre exatamente " +
            teamsCount +
            " equipes antes de gerar os grupos. Hoje existem " +
            teamsSnapshot.size +
            ".",
        );
      }

      const oldMatches =
        oldMatchesSnapshot.docs
            .map(matchPayload);

      const hasResults =
        oldMatches.some(
            hasMatchResult,
        );

      if (hasResults) {
        throw new HttpsError(
            "failed-precondition",
            "Já existem resultados lançados. O sorteio não pode ser refeito.",
        );
      }

      if (
        scheduleSnapshot.exists &&
        oldMatches.length &&
        !force
      ) {
        throw new HttpsError(
            "already-exists",
            "Os grupos já foram gerados.",
        );
      }

      const teams =
        teamsSnapshot.docs
            .map(
                (snapshot) => ({
                  id:
                    snapshot.id,

                  name:
                    safeString(
                        snapshot
                            .data()
                            ?.name,
                        40,
                    ),

                  ref:
                    snapshot.ref,
                }),
            );

      const format =
        tournamentFormat(
            teamsCount,
        );

      const groups =
        distributeTeams(
            teams,
            format,
        );

      const groupMatches =
        [];

      let order = 1;

      groups.forEach(
          (
              teamsInGroup,
              index,
          ) => {
            const id =
              format.groupCount === 1 ?
                "U" :
                groupId(index);

            const label =
              groupLabel(
                  id,
                  format.groupCount,
              );

            const generated =
              generateRoundRobin(
                  teamsInGroup,
                  id,
                  label,
                  order,
              );

            groupMatches.push(
                ...generated.matches,
            );

            order =
              generated.nextOrder;
          },
      );

      const knockout =
        generateKnockout(
            format,
            order,
        );

      const allMatches = [
        ...groupMatches,
        ...knockout.matches,
      ];

      const newMatchIds =
        new Set(
            allMatches.map(
                (match) =>
                  match.id,
            ),
        );

      let operations =
        teams.length +
        allMatches.length +
        1;

      oldMatchesSnapshot.docs
          .forEach(
              (snapshot) => {
                if (
                  !newMatchIds.has(
                      snapshot.id,
                  )
                ) {
                  operations += 1;
                }
              },
          );

      if (operations > 450) {
        throw new HttpsError(
            "resource-exhausted",
            "Quantidade de operações acima do limite seguro.",
        );
      }

      const batch =
        db.batch();

      oldMatchesSnapshot.docs
          .forEach(
              (snapshot) => {
                if (
                  !newMatchIds.has(
                      snapshot.id,
                  )
                ) {
                  batch.delete(
                      snapshot.ref,
                  );
                }
              },
          );

      const generatedTeamIds =
        [];

      groups.forEach(
          (
              teamsInGroup,
              index,
          ) => {
            const id =
              format.groupCount === 1 ?
                "U" :
                groupId(index);

            teamsInGroup.forEach(
                (team, position) => {
                  generatedTeamIds.push(
                      team.id,
                  );

                  batch.set(
                      team.ref,
                      {
                        groupId: id,
                        groupLabel:
                          groupLabel(
                              id,
                              format.groupCount,
                          ),
                        groupOrder:
                          position + 1,
                        groupUpdatedAt:
                          FieldValue
                              .serverTimestamp(),
                      },
                      {
                        merge: true,
                      },
                  );
                },
            );
          },
      );

      const matchesRef =
        context
            .tournamentRef
            .collection("matches");

      allMatches.forEach(
          (match) => {
            batch.set(
                matchesRef.doc(
                    match.id,
                ),
                {
                  stage:
                    match.stage,

                  stageLabel:
                    match.stageLabel,

                  groupId:
                    match.groupId,

                  groupLabel:
                    match.groupLabel,

                  round:
                    match.round,

                  order:
                    match.order,

                  homeTeamId:
                    match.homeTeamId,

                  awayTeamId:
                    match.awayTeamId,

                  homeSource:
                    match.homeSource,

                  awaySource:
                    match.awaySource,

                  homeScore: null,

                  awayScore: null,

                  status:
                    "scheduled",

                  generatedAt:
                    FieldValue
                        .serverTimestamp(),

                  updatedAt:
                    FieldValue
                        .serverTimestamp(),
                },
            );
          },
      );

      const scheduleRef =
        context
            .tournamentRef
            .collection("settings")
            .doc("schedule");

      batch.set(
          scheduleRef,
          {
            version:
              "v6",

            formatKey:
              format.key,

            formatLabel:
              format.label,

            groupCount:
              format.groupCount,

            groupSizes:
              format.groupSizes,

            teamsCount,

            teamIds:
              generatedTeamIds,

            groupStageMatches:
              groupMatches.length,

            knockoutMatches:
              knockout.matches.length,

            generatedBy:
              request.auth.uid,

            generatedAt:
              FieldValue
                  .serverTimestamp(),

            updatedAt:
              FieldValue
                  .serverTimestamp(),
          },
      );

      await batch.commit();

      return {
        ok: true,

        teamsCount,

        groupCount:
          format.groupCount,

        formatLabel:
          format.label,

        groupStageMatches:
          groupMatches.length,

        knockoutMatches:
          knockout.matches.length,

        totalMatches:
          allMatches.length,
      };
    },
);
