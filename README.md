# annotation




## How to install and run in Local




```sh

pip install -r requirements.txt

```


and you need to run 2 servers:


- One that handles the mapping of files:

```sh

python local.py 

```


- And one that handles the interface:

```sh

python -m http.server

```


il est également possible de générer le site sous forme d'application avec un simple npm run build:<votre_systeme_d'exploitation> ce qui permet de d'utiliser le site sans réseau 


Pour utiliser le site en local il faut pull la branche et se mettre hors ligne avec des compétitions présentes dans le dossiers courses_natation_local. (commencer les dossiers par un 2 pour qu'il soit détecté et maintenir le bon nombre de _ pour éviter des problèmes d'affichage sur les menu déroulants)

## Documentation 

L'ensemble de la documentation est visible en lançant le fichier index dans le dossier html notamment celle du code principal qui est dans /assets/js. Celui ci ouvre une page sur votre naviguateur avec les informations sur le code triées. Cette documentation a été générée automatiquement via doxygen (le doxyfile contient ses paramètres), elle n'est pas aussi performante sur du js que d'autres languages et s'appuie donc fortement sur les commentaires (et leurs fautes d'ortographe).

Ce fichier se met à jour à chaque push dans le cas où votre branche est indiquée dans le fichier ci.yml(./.github/workflows/ci.yml), il suffit de pull la branche par la suite.


Certains dossier ne sont pas visibles dans vs code en raison de leur présence dans .vscode/settings.json, cela à pour but d'épurer les fichiers visibles mais n'hésitez pas à changer ce fichier.



