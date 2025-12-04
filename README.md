# TripSync

### Data Processing
We process data in Google Drive & Colab at https://drive.google.com/drive/folders/1QuevTAN-a_F7zCLVu1J1-hd3A4QYkL9h?usp=sharing


### Server
Create a `config.json` file in the `server` directory with the following structure:
```json
{
  "rds_host": "db_host",
  "rds_user": "db_username",
  "rds_password": "db_password",
  "rds_port": "db_port",
  "rds_db": "db_name",
  "server_host": "localhost",
  "server_port": 3000
}
```

Use `npm install` to install.
Use `npm run dev` to start the server in development mode with auto-reloading.
Use `npm start` to start the server in production mode.