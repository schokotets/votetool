#!/bin/sh
docker-compose build
docker-compose rm -f -s web
docker-compose up web
