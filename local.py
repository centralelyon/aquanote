"""
@file local.py
@brief Serveur Flask API pour servir les données de courses de natation en mode local
Fournit les endpoints REST pour récupérer les compétitions, courses, données et fichiers
Configure CORS, compression et cache pour optimiser les performances
"""

import ujson
from flask import Flask, Response
import os
from flask_caching import Cache
from flask_compress import Compress
from flask_cors import CORS


base = './courses_demo'

app = Flask(__name__, static_folder=base, static_url_path='/files')

COMPRESS_MIMETYPES = ['text/html', 'text/css', 'text/plain', 'text/csv', 'text/xml', 'application/json',
                      'application/javascript', 'image/jpeg', 'image/png', 'video/mp4']
COMPRESS_LEVEL = 6
COMPRESS_MIN_SIZE = 500

cache = Cache(config={'CACHE_TYPE': 'simple'})
cache.init_app(app)
Compress(app)
CORS(app)


# TODO:Get runs in DIR


@app.route('/getCompets')
def getCompets():
    print("getCompets")
    res = []
    for dir in os.listdir(base):
        if os.path.isdir(os.path.join(base, dir)):
            res.append(
                {
                    "name": dir,
                    "type": "directory"
                }
            )

    resp = Response(response=ujson.dumps(
        res
    ),
        status=200,
        mimetype="application/json")
    print(resp)
    return resp


@app.route('/getRuns/<compet>')
def getruns(compet):
    res = []
    based = os.path.join(base, compet)
    for dir in os.listdir(based):
        if os.path.isdir(os.path.join(based, dir)):
            res.append(
                {
                    "name": dir,
                    "type": "directory"
                }
            )

    resp = Response(response=ujson.dumps(
        res
    ),
        status=200,
        mimetype="application/json")
    print(resp)
    return resp


@app.route('/getDatas/<compet>/<run>')
def getDatas(compet, run):
    res = []
    based = os.path.join(os.path.join(base, compet), run)
    for file in os.listdir(based):
        if os.path.isfile(os.path.join(based, file)):
            res.append(
                {
                    "name": file,
                    "type": "file"
                }
            )
    resp = Response(response=ujson.dumps(
        res
    ),
        status=200,
        mimetype="application/json")
    # print(resp)
    return resp


@app.route('/getQuality/<compet>/<run>')
def getQuality(compet, run):
    res = []
    based = os.path.join(os.path.join(base, compet), run)
    for file in os.listdir(based):
        if os.path.isfile(os.path.join(based, file)):
            res.append(
                {
                    "name": file,
                    "type": "file"
                }
            )
    resp = Response(response=ujson.dumps(
        res
    ),
        status=200,
        mimetype="application/json")
    return resp


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)
