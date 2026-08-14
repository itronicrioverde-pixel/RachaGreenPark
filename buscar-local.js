/*
 * Green Park FC - busca de locais para o painel Admin.
 * Anexar este arquivo ao final de functions/index.js.
 *
 * Usa Photon/OpenStreetMap no servidor, evitando falhas de CORS no iPhone/PWA.
 */

exports.buscarLocal = onCall(
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

      const queryText =
        String(request.data?.query || "")
            .trim()
            .slice(0, 120);

      if (queryText.length < 2) {
        return {places: []};
      }

      const searchText =
        `${queryText}, Rio Verde, Goiás, Brasil`;

      const params = new URLSearchParams({
        q: searchText,
        limit: "7",
        lang: "pt",
        countrycode: "BR",
        lat: "-17.7994",
        lon: "-50.9320",
      });

      const url =
        "https://photon.komoot.io/api/?" +
        params.toString();

      const response = await fetch(
          url,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
          },
      );

      if (!response.ok) {
        console.error(
            "Erro Photon:",
            response.status,
        );

        throw new HttpsError(
            "unavailable",
            "Busca de endereço indisponível.",
        );
      }

      const data = await response.json();

      const features =
        Array.isArray(data.features) ?
          data.features :
          [];

      const places =
        features.map((feature) => {
          const p =
            feature.properties || {};

          const coords =
            Array.isArray(
                feature.geometry?.coordinates,
            ) ?
              feature.geometry.coordinates :
              [];

          const parts = [
            p.street,
            p.housenumber,
            p.district,
            p.city,
            p.county,
            p.state,
            p.postcode,
          ].filter(Boolean);

          const uniqueParts =
            [...new Set(parts)];

          return {
            name:
              p.name ||
              p.street ||
              p.city ||
              "Local",
            address:
              uniqueParts.join(", ") ||
              [
                p.city,
                p.state,
                p.country,
              ].filter(Boolean).join(", "),
            latitude:
              coords.length >= 2 ?
                coords[1] :
                null,
            longitude:
              coords.length >= 2 ?
                coords[0] :
                null,
          };
        });

      return {places};
    },
);
