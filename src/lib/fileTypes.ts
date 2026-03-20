import { FileText, Image, FileSpreadsheet, FileType } from "lucide-react";

export const ALLOWED_EXTENSIONS = [
  '.pdf', '.md', '.ppt', '.pptx', '.xls', '.xlsx',
  '.doc', '.docx', '.csv', '.jpg', '.jpeg', '.png',
];

export const ACCEPT_STRING = ALLOWED_EXTENSIONS.join(',');

export function getFileExtension(fileName: string): string {
  return (fileName.split('.').pop() || '').toLowerCase();
}

export function isAllowedFile(file: File): boolean {
  const ext = '.' + getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext);
}

export function getFileCategory(fileName: string): 'pdf' | 'image' | 'spreadsheet' | 'document' | 'other' {
  const ext = getFileExtension(fileName);
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  if (['doc', 'docx', 'md', 'ppt', 'pptx'].includes(ext)) return 'document';
  return 'other';
}

export function getFileIcon(fileName: string) {
  const cat = getFileCategory(fileName);
  switch (cat) {
    case 'image': return Image;
    case 'spreadsheet': return FileSpreadsheet;
    case 'document': return FileType;
    default: return FileText;
  }
}
