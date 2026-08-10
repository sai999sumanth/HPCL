import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../@/components/ui/table";
import { Button } from '../../../@/components/ui/button';
import { MoreHorizontal } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "../../../@/components/ui/dropdown-menu";
import images from './images';


interface CredentialsTableProps {
  credentials: any[];
  onEdit: (credential: any) => void;
  onDelete: (id: string) => void;
}

const CredentialsTable: React.FC<CredentialsTableProps> = ({ credentials, onEdit, onDelete }) => { 
  if (!credentials || credentials.length === 0) {  
    return <div className="text-center p-4">No credentials found.</div>;
  }

  const getIconForCredType = (credType: string) => {
    if (images[credType]) {
      return images[credType];
    }
    const iconKey = `${credType}-icon`;
    return images[iconKey] || null;
  };

  return (
    <>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Host</TableHead>
          <TableHead>Port</TableHead>
          <TableHead>Username</TableHead>
          <TableHead>Database</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {credentials.map((cred) => ( 
          <TableRow key={cred.id}>
            <TableCell>{cred?.name || "N/A"}</TableCell>
            <TableCell className="">
              {getIconForCredType(cred.cred_type) && (
                <img 
                  src={getIconForCredType(cred.cred_type)} 
                  alt={`${cred.cred_type} icon`} 
                  className="w-8 h-8 mr-2" 
                />
              )}
            </TableCell>
            <TableCell>{cred?.cred_model || "N/A"}</TableCell>
            <TableCell>{cred.credentials?.host || "N/A"}</TableCell>
            <TableCell>{cred.credentials?.port || "N/A"}</TableCell>
            <TableCell>{cred.credentials?.user_name || "N/A"}</TableCell>
            <TableCell>{cred.credentials?.database_name || "N/A"}</TableCell>
            <TableCell>{new Date(cred?.created_at).toLocaleString() || "N/A" }</TableCell>
            <TableCell>{new Date(cred?.updated_at).toLocaleString() || "N/A" }</TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(cred)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(cred.id)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </>

    
  );
};

export default CredentialsTable;