FROM node:current-alpine

EXPOSE 8083
ENV DB_PORT 5432
ENV DB_HOST localhost
ENV DB_NAME votetool
ENV DB_USER postgres
ENV DB_PASSWORD password

RUN mkdir -p /app && chown -R node:node /app

WORKDIR /app

COPY --chown=node:node package.json yarn.lock ./

RUN chmod +w yarn.lock

USER node
RUN yarn

ADD *.ts *.html *.css static ./
RUN yarn run tsc *.ts

CMD ["index.js"]

