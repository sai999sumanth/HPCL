# urdhva_base

##  Urdhva Base Framework With Auto SQL Schema Generation

### Steps to configure / install urdhva_base

1. Install Python3.12
2. Create Python environment with Python3.12
3. pip install -e .  # For dev setup
4. python setup.py install # For production setup


# For Code Generation
1. Create New folder <Folder>
2. cd <Folder>
3. create model file
**## Example model File**
**### open test.model file**
##### Ex:-  
    Model test {
       name str
       id str
       age index_field int
       check optional default=true bool
       SchemaTest str
       default_key list str
    
       Action=> test123 {
            test123 index_field str
            test1234 str
       }
       Action=> test12345 {
            test123 str
            test1234 str
       }
    
       Action=> abba {
    }
       Config=> {
            collection_name=tetCollection
       }
    
    }
    
    Model BaseTest {
       a str
       Action=> action1 {
        }
      Action=> action2 {
        }
    }

4. python -m urdhva_base.model -g python -d postgres -f test.model

# Documentation
## Attributes
**1. Primary Key** 
##### Ex:- 
      name primary_key str

**2. Index Key**
##### Ex:- 
      index_key index_field str

**3. Unique Key** 
##### Ex:- 
      unique_key unique_field str

**4. All three can be combined**
##### Ex:- 
      name primary_key index_field unique_field str

## For Datetime without timezone use datetime_no_zone 
##### Ex:- 
      external_timestamp optional datetime_no_zone

## For Datetime with timezone use datetime 
##### Ex:- 
      timestamp optional datetime

## Config
**1. Entity as Unique Key** 
####    Entity as unique will add entity_id to unique fields along with provided one  
      Ex:- Config=> {
                unique_on_entity
            }

**2. ForeignKey** 
   ##### ForeignKey is used to add any particular key as foreign key for this table 
        Ex:- Config=> {
                foreign_keys='organization_id=organization.id'
             }
   ##### Incase If ForeignKey was a BigInteger or id of another class or same class need to add a key called int after resource name
   ##### If int not mentioned it will take default variable type
        Ex:- Config=> {
                foreign_keys='organization_id=organization.id::int;instance_id=resource.resource_id'
             }
   ##### **Note:-** if any key we are keeping as ForeignKey make sure the key was marked as unique_field 

**3. Crud Operations** 
   ##### This option will be used to keep only required crud operations from read, create, update
        Ex:- Config=> {
                crud_operations='read'
              }  

## Disable CrudOperations
1. Disable crud operation will take care of disabling entire read, create and update operations for the given model
   ##### Ex:- Model UserManagement crud_disable {
            Action=> get_user_action_params {
            }
            Action=> create_role {
                 name str
            }
        }

## How to configure generated schema in postgres
   ##### To create each model schema follow below steps post model file generation
   ##### Ex:- 
            cd <Path to _model.py file>
            Enable Environement if any
            python
            >> from <basename>_model import *
            >> import urdhva_base
            >> import asyncio
            >> asyncio.run(urdhva_base.postgresmodel.create_tables())

# Any queries reach out to **venu@algofusiontech.com** (Venugopalnaidu Chandra)
