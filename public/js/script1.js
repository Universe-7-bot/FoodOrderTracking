let counter = 0;
const spanElements = document.querySelectorAll('.mask span');

function rotateWords() {
    const currentSpan = spanElements[counter];
    const nextIndex = (counter + 1) % spanElements.length;
    const nextSpan = spanElements[nextIndex];

    currentSpan.removeAttribute('data-show');
    currentSpan.setAttribute('data-up', '');

    setTimeout(() => {
        currentSpan.removeAttribute('data-up');
        nextSpan.setAttribute('data-show', '');
    }, 500);

    counter = nextIndex;
}

setInterval(rotateWords, 2000);
