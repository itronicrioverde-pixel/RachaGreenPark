/* GREENPARK_TOURNAMENT_ADMIN_COMPACT_V33 */


function addCompactStyle(){

  if(
    document.getElementById(
      'greenpark-tournament-admin-compact-v33-style'
    )
  ){
    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'greenpark-tournament-admin-compact-v33-style';


  style.textContent = `

/* ==========================================================
   GREEN PARK - CONFIGURAR TORNEIO COMPACTO V3.3
   ========================================================== */


/* CARD PRINCIPAL */

#tournamentsView
#tournamentAdminPanel{
  padding:11px!important;
  border-radius:15px!important;
}


/* CABECALHO */

#tournamentsView
#tournamentAdminPanel
.gptournament-admin-title{
  min-height:30px!important;
  margin:0 0 10px!important;
}

#tournamentsView
#tournamentAdminPanel
.gptournament-admin-title strong{
  font-size:11px!important;
}

#tournamentsView
#tournamentAdminPanel
.gptournament-admin-title span{
  font-size:7px!important;
}


/* ==========================================================
   GRID PRINCIPAL

   1 - NOME ............... largura total
   2 - DATA | STATUS ...... lado a lado
   3 - LOCAL .............. largura total
   4 - EQUIPES | FORMATO .. lado a lado
   ========================================================== */

#tournamentsView
#gptournamentAdminPanel{
  min-width:0!important;
}

#tournamentsView
#gptournamentAdminPanel,
#tournamentsView
#tournamentAdminPanel{
  box-sizing:border-box!important;
}


#tournamentsView
#tournamentAdminPanel
.gptv44-grid{

  display:grid!important;

  grid-template-columns:
    minmax(0,1fr)
    minmax(0,1fr)!important;

  gap:8px!important;

  width:100%!important;

}


/* NOME */

#tournamentsView
#tournamentAdminPanel
.gptv44-grid
> .gptv44-field:nth-child(1){

  grid-column:1 / -1!important;

}


/* DATA */

#tournamentsView
#tournamentAdminPanel
.gptv44-grid
> .gptv44-field:nth-child(2){

  grid-column:1!important;

}


/* STATUS */

#tournamentsView
#tournamentAdminPanel
.gptv44-grid
> .gptv44-field:nth-child(3){

  grid-column:2!important;

}


/* LOCAL */

#tournamentsView
#tournamentAdminPanel
.gptv44-grid
> .gptv44-field:nth-child(4){

  grid-column:1 / -1!important;

}


/* EQUIPES */

#tournamentsView
#tournamentAdminPanel
.gptv44-grid
> .gptv44-field:nth-child(5){

  grid-column:1!important;

}


/* FORMATO */

#tournamentsView
#tournamentAdminPanel
.gptv44-grid
> .gptv44-field:nth-child(6){

  grid-column:2!important;

}


/* ==========================================================
   LABELS
   ========================================================== */

#tournamentsView
#tournamentAdminPanel
.gptv44-label{

  margin:0 0 4px!important;

  font-size:7px!important;
  line-height:1!important;

  letter-spacing:.03em!important;

}


/* ==========================================================
   CAMPOS
   ========================================================== */

#tournamentsView
#tournamentAdminPanel
.gptv44-control{

  height:42px!important;
  min-height:42px!important;
  max-height:42px!important;

  padding:0 9px!important;

  border-radius:9px!important;

  font-size:12px!important;

}


/* NOME E LOCAL */

#tournamentsView
#tournamentNameInput,
#tournamentsView
#tournamentLocationInput{

  font-size:12px!important;

}


/* DATA */

#tournamentsView
#gptv44DateDisplay{

  font-size:12px!important;

  padding-left:5px!important;
  padding-right:5px!important;

}


/* STATUS */

#tournamentsView
#tournamentStatusInput{

  height:42px!important;
  min-height:42px!important;
  max-height:42px!important;

  padding:
    0 20px 0 6px!important;

  font-size:10px!important;

}


/* ==========================================================
   EQUIPES
   ========================================================== */

#tournamentsView
.gptv44-team-row{

  grid-template-columns:
    38px
    minmax(0,1fr)
    38px!important;

  gap:5px!important;

}


#tournamentsView
.gptv44-team-step{

  width:38px!important;
  min-width:38px!important;

  height:42px!important;
  min-height:42px!important;

  border-radius:9px!important;

  font-size:20px!important;

}


#tournamentsView
#gptv4TeamsCountInput{

  width:100%!important;

  height:42px!important;
  min-height:42px!important;
  max-height:42px!important;

  padding:0 3px!important;

  border-radius:9px!important;

  font-size:17px!important;

}


/*
 * V3.2 SALVA A QUANTIDADE JUNTO COM
 * SALVAR CAMPEONATO.
 *
 * Portanto o botao separado virou redundante.
 */

#tournamentsView
#gptv44TeamsSave{

  display:none!important;

}


/* Esconde apenas a explicacao fixa "3 a 32".
   Mensagem de erro/sucesso continua funcionando. */

#tournamentsView
.gptv44-grid
> .gptv44-field:nth-child(5)
> .gptv44-help:not(#gptv44TeamsMessage){

  display:none!important;

}


#tournamentsView
#gptv44TeamsMessage{

  min-height:0!important;

  margin:3px 0 0!important;

  font-size:6.5px!important;

}


#tournamentsView
#gptv44TeamsMessage:empty{

  display:none!important;

}


/* ==========================================================
   FORMATO
   ========================================================== */

#tournamentsView
#gptv44FormatValue{

  width:100%!important;

  height:42px!important;
  min-height:42px!important;

  padding:4px 6px!important;

  border-radius:9px!important;

  font-size:9px!important;
  line-height:1.15!important;

  white-space:normal!important;

}


/* ==========================================================
   DATA - MENSAGEM
   ========================================================== */

#tournamentsView
#gptv44DateMessage{

  min-height:0!important;

  margin:3px 0 0!important;

  font-size:6.5px!important;

}


#tournamentsView
#gptv44DateMessage:empty{

  display:none!important;

}


/* ==========================================================
   SALVAR CAMPEONATO
   ========================================================== */

#tournamentsView
#tournamentSaveButton{

  min-height:43px!important;
  height:43px!important;

  margin-top:10px!important;

  border-radius:10px!important;

  font-size:9px!important;

}


/* Mensagem da persistencia */

#tournamentsView
#gptv32SaveMessage{

  min-height:0!important;

  margin-top:5px!important;

  font-size:7px!important;

}


#tournamentsView
#gptv32SaveMessage:empty{

  display:none!important;

}


/* ==========================================================
   MOBILE ESTREITO
   ========================================================== */

@media(max-width:350px){

  #tournamentsView
  #tournamentAdminPanel
  .gptv44-grid{

    gap:6px!important;

  }


  #tournamentsView
  #tournamentStatusInput{

    font-size:9px!important;

  }


  #tournamentsView
  .gptv44-team-row{

    grid-template-columns:
      34px
      minmax(0,1fr)
      34px!important;

    gap:4px!important;

  }


  #tournamentsView
  .gptv44-team-step{

    width:34px!important;
    min-width:34px!important;

  }


  #tournamentsView
  #gptv44FormatValue{

    font-size:8px!important;

  }

}

`;


  document.head.appendChild(
    style
  );
}


function shortenLabels(){

  const grid =
    document.querySelector(
      '#tournamentsView ' +
      '#tournamentAdminPanel ' +
      '.gptv44-grid'
    );


  if(!grid){
    return false;
  }


  const fields =
    Array.from(
      grid.children
    );


  const names = [
    'NOME',
    'DATA',
    'STATUS',
    'LOCAL',
    'EQUIPES',
    'FORMATO'
  ];


  fields.forEach(
    (field,index) => {

      const label =
        field.querySelector(
          '.gptv44-label'
        );


      if(
        label &&
        names[index]
      ){
        label.textContent =
          names[index];
      }

    }
  );


  const saveButton =
    document.getElementById(
      'tournamentSaveButton'
    );


  if(saveButton){

    /*
     * Mantemos a funcao original.
     * So reduzimos o texto visual.
     */
    if(
      !saveButton.disabled
    ){
      saveButton.textContent =
        'SALVAR CAMPEONATO';
    }

  }


  return true;
}


async function init(){

  addCompactStyle();


  for(
    let attempt = 0;
    attempt < 100;
    attempt += 1
  ){

    if(shortenLabels()){
      break;
    }


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );

  }


  const view =
    document.getElementById(
      'tournamentsView'
    );


  if(view){

    const observer =
      new MutationObserver(
        () => {

          shortenLabels();

        }
      );


    observer.observe(
      view,
      {
        childList:true,
        subtree:true
      }
    );

  }

}


init();
