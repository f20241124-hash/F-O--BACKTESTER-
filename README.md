Download SQL Sever Management studios from Microsoft website.

Connect to database using Windows Authentication.
Create a database named BacktesterDB, using command 
create database BacktesterDB;
Under security->logins, make a new login.
Add the login name in .env file as DB_User and its SQL auth password as DB_Password.

Under server roles, do checkbox public, sysadmin.
Specify which database access is to be given to this login.
Then apply the settings.

to run the website, write npm start in the terminal.