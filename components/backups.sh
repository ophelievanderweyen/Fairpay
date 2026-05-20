#!/bin/bash

# ==============================
# CONFIGURATION BASE DE DONNÉES
# ==============================

USER_DB="ar62yy13raif"
PASSWORD_DB="a0~p6a?2pa"
NAME_DB="ebus2_projet03_aarr19"
SERVER_DB="localhost"

# ==============================
# DOSSIERS
# ==============================

DIR_BACKUP="/home/projet03/backups"
DIR_LOGS="/home/projet03/logs"

# ==============================
# DATE + NOM DU FICHIER
# ==============================

DATE=$(date +%Y-%m-%d_%H-%M)

FILE_BACKUP="$DIR_BACKUP/backup_$DATE.sql.gz"
FILE_LOG="$DIR_LOGS/backup_error.log"

# ==============================
# CRÉATION DOSSIERS SI ABSENTS
# ==============================

mkdir -p "$DIR_BACKUP"
mkdir -p "$DIR_LOGS"

# ==============================
# SAUVEGARDE MYSQL
# ==============================

mysqldump -h "$SERVER_DB" -u "$USER_DB" -p"$PASSWORD_DB" "$NAME_DB" 2> "$FILE_LOG" | gzip > "$FILE_BACKUP"

# ==============================
# SUPPRESSION > 1 JOURS
# ==============================

find "$DIR_BACKUP" -type f -name "*.sql.gz" -mtime +1 -delete