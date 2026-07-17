
Download react.js, node.js.
Download SQL Sever Management studios from Microsoft website.

Connect to server using Windows Authentication.
Create a database named BacktesterDB, using command 
create database BacktesterDB;
Under security->logins (on left side), make a new login.
Add the login name in .env file as DB_User and its SQL auth password as DB_Password.

Under server roles, do checkbox public, sysadmin.
Specify which database access is to be given to this login.
Then apply the settings.

Also, open SQL Server Configuration Manger. Under SQL Server Services start the SQL Server and SQL Server Browser. Aslo, under SQL Server Network Configuration, enable TCP/IP protocol.

to run the website, write npm start in the terminal.
