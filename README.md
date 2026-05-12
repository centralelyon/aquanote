# Aquanote

_An annotation tool for race swimming videos (using one or multiple static cameras)._

<img src="https://centralelyon.github.io/swimming/figures/aquanote.png" alt="Aquanote screenshot" style="max-width:100%;height:auto;">

## How to install and run locally


### Using `venv` (recommended)

1. **Create a virtual environment:**

```bash
python -m venv venv
```

2. **Activate the environment:**

* On macOS/Linux:

```bash
source venv/bin/activate
```
* On Windows:

```bash
venv\Scripts\activate
```

3. **Install the module:**

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Basic usage:

You need to run 2 servers:

1/ A server to deliver the files:

```sh
python local.py 
```

2/ Another server that hosts the web application:

```sh
npm start
```

Then you can open your browser at http://127.0.0.1:8000

To use the site locally, you need to pull the branch and go offline with competitions present in the `courses_natation_local` folder. (Start the folders with a **2** so they are detected, and keep the correct number of underscores `_` to avoid display issues in the dropdown menus.)  

## Data structure and analysis

### Structure of annotated data 

Aquanote uses a specific data structure to store the annotations. It is based on a CSV file for each video, with samples provided in the [`course_demo`](courses_demo/2025_courses_demo/2025_courses_demo_translation_carre_100_demifinale) folder. Here is a sample of such a CSV file:

```
frameId,swimmerId,swimmerName,lane,cumul,eventId,eventX,eventY,event,TempsVideo (s),Temps (s),distance (m),tempo (s),frequence (cylce/min),amplitude (m),vitesse (m/s)
63,4,ligne5,ligne5,3.90,0,46.1036,8,cycle,1.36,1.26,3.90,,,,
113,4,ligne5,ligne5,6.87,1,43.1305,8,cycle,2.36,2.26,6.87,2.00,30.00,5.95,2.97
```

### Analysis of annotated data 

To analyse the CSV file, a dedicated repository is available:

**[aquanalysis](https://github.com/centralelyon/aquanalysis)** is a repository that contains scripts and notebooks to compute various performance metrics from the annotated data, such as speed, stroke rate, and stroke length.

### Adding new videos

The videos provided is in the `courses_demo` folder are samples. To add your own videos, you need to follow the same structure as in the demo folder. 

Each competition should have its own subfolder, and then videos to used should be specified in a `metadata JSON` file located at the root of each competition folder. For example, for the demo competition the metadata file is `2025_courses_demo_translation_carre_50_finale`, 

**[flatdir](https://github.com/centralelyon/flatdir)** is a Python module to flatten a directory structure and automatically generate the required JSON files at the root of each competition folder (like the [`courses_demo/flat.json`](courses_demo/flat.json) JSON, add `> flat.json` to save the output in such a file):

> python -m flatdir courses_demo --limit 10 --nested --only type=directory --add espadon=false --add espadonModifie=false --add data_checked=false --no-defaults --min-depth 1 --add-depth 2 --ignore-typical

### Pre-processing videos

A `metadata JSON` contains information about pre-processing steps for each race to analyzed and should be created before the annotation phase. This includes temporal calibration (start and end times), spatial calibration (real-world dimensions) and athletes information (names, lanes). An example of such a JSON file is available in the demo folder: [`courses_demo/2025_courses_demo_translation_carre_50_finale/metadata.json`.](courses_demo/2025_courses_demo_translation_carre_50_finale/metadata.json).

While some pre-processingt steps can be done directly in Aquanote, some require external video and image processing tools. We suggest two tools to achieve this: 

[**ntt**](https://github.com/centralelyon/ntt/) for image and video processing using warppers around **OpenCV** and **FFmpeg** libraries (for instance).

[**pipeoptz**](https://github.com/centralelyon/pipeoptz/) to orchestrate such processing as pipelines and eventually optimize their parameters automatically.


## Documentation  

All documentation can be viewed by launching the **index** file in the `html` folder, in particular the documentation for the main code located in `/assets/js`. This opens a page in your browser with sorted information about the code.  

This documentation was automatically generated via **Doxygen** (the `doxyfile` contains its settings). It is not as effective for JavaScript as it is for other languages, so it relies heavily on comments (and their spelling mistakes).  

This file is updated with every push, provided your branch is listed in the `ci.yml` file (`./.github/workflows/ci.yml`). After that, you just need to pull the branch.  

Some folders are not visible in VS Code because they are hidden in `.vscode/settings.json`. This is meant to declutter the visible files, but feel free to modify this file.  


## Acknowledgments

<img src="https://liris.cnrs.fr/sites/default/files/logo_liris_160_0.png" style="height:50px">&nbsp;&nbsp;&nbsp;<img src="https://www.ec-lyon.fr/sites/default/files/styles/paragraph_image/public/content/paragraphs/images/2024-10/2024_logo-centrale-h_rouge_rvb.jpg.webp" style="height:50px">&nbsp;&nbsp;&nbsp;<img src="https://www.natation-handisport.org/wp-content/uploads/2021/10/logo_NePTUNE_color-768x204.png" style="height:50px">
