let categoriesContainer = document.getElementById('vvp-browse-nodes-container');
let categoriesList = categoriesContainer.getElementsByClassName('parent-node');
let categoriesArray = [];

// Create a 2D array of category names and their corresponding count (and remove brackets)
for (let i = 0; i < categoriesList.length; i++) {
    categoriesArray.push([categoriesList[i]
        .querySelector('.a-link-normal').innerText, categoriesList[i].querySelector('span')
        .innerText.replace('(', '').replace(')', '').trimStart()]);
}

console.log(categoriesArray);