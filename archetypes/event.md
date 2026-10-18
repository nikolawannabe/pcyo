+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName "-" " " | title }}'
expiryDate = '{{ .Date }}'
type =  "event"
location =  ""
eventStartDate = "{{ .Date }}"
eventEndDate = "{{ .Date }}"
layout = "events"
+++
