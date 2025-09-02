# Aquanote

_Aquanote is a user-friendly platform designed for coaches, athletes, and analysts to annotate race swimming videos._

## How to install and run locally


```sh
pip install -r requirements.txt
```

And you need to run 2 servers:


1/ One that handles the mapping of files:

```sh
python local.py 
```

2/ And the other one that handles the interface:

```sh
python -m http.server
```

Then you can open your browser at http://localhost:8000

It is also possible to generate the site as an application with a simple command like this:

`npm run build:<your_operating_system>`   

which allows you to use the site without a network connection.  

To use the site locally, you need to pull the branch and go offline with competitions present in the `courses_natation_local` folder. (Start the folders with a **2** so they are detected, and keep the correct number of underscores `_` to avoid display issues in the dropdown menus.)  

## Documentation  

All documentation can be viewed by launching the **index** file in the `html` folder, in particular the documentation for the main code located in `/assets/js`. This opens a page in your browser with sorted information about the code.  

This documentation was automatically generated via **Doxygen** (the `doxyfile` contains its settings). It is not as effective for JavaScript as it is for other languages, so it relies heavily on comments (and their spelling mistakes).  

This file is updated with every push, provided your branch is listed in the `ci.yml` file (`./.github/workflows/ci.yml`). After that, you just need to pull the branch.  

Some folders are not visible in VS Code because they are hidden in `.vscode/settings.json`. This is meant to declutter the visible files, but feel free to modify this file.  


## Acknowledgments

<img src="https://liris.cnrs.fr/sites/default/files/logo_liris_160_0.png" style="height:50px">&nbsp;&nbsp;&nbsp;<img src="https://www.ec-lyon.fr/sites/default/files/styles/paragraph_image/public/content/paragraphs/images/2024-10/2024_logo-centrale-h_rouge_rvb.jpg.webp" style="height:50px">&nbsp;&nbsp;&nbsp;<img src="https://www.natation-handisport.org/wp-content/uploads/2021/10/logo_NePTUNE_color-768x204.png" style="height:50px">
