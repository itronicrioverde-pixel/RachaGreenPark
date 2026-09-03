/* GREENPARK_UI_POLISH_V1 */


function polishConfirmedRows(){

  document
    .querySelectorAll(
      '#confirmedListView .confirmed-player-row'
    )
    .forEach(
      row => {

        const badge =
          row.querySelector(
            ':scope > .confirmed-player-badge'
          );


        if(
          badge &&
          String(
            badge.textContent ||
            ''
          )
            .toLocaleUpperCase(
              'pt-BR'
            )
            .includes(
              'CONFIRMADO'
            )
        ){

          badge.classList.add(
            'gpuiv1-confirmed'
          );


          badge.setAttribute(
            'title',
            'Confirmado'
          );

        }


        const remove =
          row.querySelector(
            ':scope > .admin-cancel-racha-btn'
          );


        if(remove){

          remove.classList.add(
            'gpuiv1-remove'
          );


          remove.setAttribute(
            'title',
            'Remover do racha'
          );


          remove.setAttribute(
            'aria-label',
            'Remover jogador do racha'
          );

        }

      }
    );

}


function init(){

  polishConfirmedRows();


  const list =
    document.getElementById(
      'confirmedListItems'
    );


  if(list){

    const observer =
      new MutationObserver(
        polishConfirmedRows
      );


    observer.observe(
      list,
      {
        childList:true,
        subtree:true
      }
    );

  }

}


if(
  document.readyState ===
  'loading'
){

  document.addEventListener(
    'DOMContentLoaded',
    init,
    {
      once:true
    }
  );

}else{

  init();

}
