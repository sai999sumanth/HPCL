import postgresqlIcon from '../../../assets/images/postgresql-icon.svg';
import mysqlIcon from '../../../assets/images/mysql-icon.svg';
import oracleIcon from '../../../assets/images/oracle-icon.svg';
import mssqlIcon from '../../../assets/images/mssql-icon.svg';
import s4hanaIcon from '../../../assets/images/s4hana-icon.svg';
import mongoIcon from '../../../assets/images/mongo-icon.svg';
import SalesforceIcon from '../../../assets/images/salesforce-icon.svg';
import s3Icon from '../../../assets/images/s3-icon.svg';
import elasticsearchIcon from '../../../assets/images/elasticsearch-icon.svg';
import redisIcon from '../../../assets/images/redis-icon.svg';
import csvIcon from '../../../assets/images/csv--color.svg';
import excelIcon from '../../../assets/images/excel-color.svg';
import parquetIcon from '../../../assets/images/parquet-color.svg';
import featherIcon from '../../../assets/images/Apache_Feather_Logo.svg.png';
import jsonIcon from '../../../assets/images/json-color.svg';
import emailIcon from '../../../assets/images/email.svg';
import sftpIcon from '../../../assets/images/sftp.svg';

const images: { [key: string] : string } = { 
  'Email':emailIcon,
  'SFTP':sftpIcon,
  'PostgreSQL': postgresqlIcon,
  'MySQL': mysqlIcon,
  'Oracle': oracleIcon,
  'MsSQL': mssqlIcon,
  'S4 Hana': s4hanaIcon,
  'Salesforce': SalesforceIcon,
  's3':s3Icon,
  'ElasticSearch':elasticsearchIcon,
  'CSVFile':csvIcon,
  'Ms Excel': excelIcon,
  'ParquetFile': parquetIcon,
  'FeatherFile': featherIcon,
  'JsonFile': jsonIcon,
};

export default images;