import { useEffect, useState } from 'react';
import { Users, Search, Edit, Loader2, Trash2, AlertTriangle, UserPlus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { EmptyState } from '../../admin/EmptyState';
import { getAllUsers, updateUser, deleteUser, createUser } from '../../../services/adminService';
import { toast } from 'sonner';

interface AdminUsersScreenProps {
  accessToken: string;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin:    'bg-purple-100 text-purple-800',
    operator: 'bg-blue-100 text-blue-800',
    auditor:  'bg-orange-100 text-orange-800',
    citizen:  'bg-gray-100 text-gray-800',
  };
  const labels: Record<string, string> = {
    admin: 'Administrador', operator: 'Operador', auditor: 'Auditor', citizen: 'Ciudadano',
  };
  return (
    <Badge className={colors[role] ?? 'bg-gray-100 text-gray-800'} variant="outline">
      {labels[role] ?? role}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
    active: 'default', inactive: 'secondary', suspended: 'destructive',
  };
  const labels: Record<string, string> = {
    active: 'Activo', inactive: 'Inactivo', suspended: 'Suspendido',
  };
  return (
    <Badge variant={variants[status] ?? 'secondary'}>
      {labels[status] ?? status}
    </Badge>
  );
}

function formatDate(dateString?: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function AdminUsersScreen({ accessToken }: AdminUsersScreenProps) {
  const [loading,         setLoading]         = useState(true);
  const [users,           setUsers]           = useState<any[]>([]);
  const [filteredUsers,   setFilteredUsers]   = useState<any[]>([]);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [roleFilter,      setRoleFilter]      = useState('all');
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [currentUserId,   setCurrentUserId]   = useState('');

  // Edit
  const [editOpen,        setEditOpen]        = useState(false);
  const [selectedUser,    setSelectedUser]    = useState<any>(null);
  const [editRole,        setEditRole]        = useState('');
  const [editStatus,      setEditStatus]      = useState('');
  const [saving,          setSaving]          = useState(false);

  // Delete
  const [deleteOpen,      setDeleteOpen]      = useState(false);
  const [deleteConfirm,   setDeleteConfirm]   = useState(false);
  const [userToDelete,    setUserToDelete]    = useState<any>(null);
  const [deleting,        setDeleting]        = useState(false);

  // Create
  const [createOpen,      setCreateOpen]      = useState(false);
  const [newName,         setNewName]         = useState('');
  const [newEmail,        setNewEmail]        = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [newRole,         setNewRole]         = useState('citizen');
  const [newStatus,       setNewStatus]       = useState('active');
  const [creating,        setCreating]        = useState(false);

  useEffect(() => {
    // Obtener ID del usuario actual desde localStorage
    const savedUser = localStorage.getItem('admin_user');
    if (savedUser) {
      try { setCurrentUserId(JSON.parse(savedUser).id ?? ''); } catch { /* ignore */ }
    }
    loadUsers();
  }, [accessToken]);

  // Filtrado local (rol y estado — la búsqueda va al servidor)
  useEffect(() => {
    let filtered = [...users];
    if (roleFilter   !== 'all') filtered = filtered.filter(u => u.role === roleFilter);
    if (statusFilter !== 'all') filtered = filtered.filter(u => (u.status ?? 'active') === statusFilter);
    setFilteredUsers(filtered);
  }, [users, roleFilter, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await getAllUsers(accessToken, {
      search: searchQuery.trim() || undefined,
    });
    if (data) { setUsers(data); setFilteredUsers(data); }
    else toast.error('Error al cargar usuarios', { description: error ?? '' });
    setLoading(false);
  };

  // Re-cargar cuando el search cambia (debounce visual)
  useEffect(() => {
    const t = setTimeout(loadUsers, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditRole(user.role ?? 'citizen');
    setEditStatus(user.status ?? 'active');
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setSaving(true);
    const { data, error } = await updateUser(accessToken, selectedUser.id, {
      role:   editRole   as any,
      status: editStatus as any,
    });
    if (data) {
      toast.success('Usuario actualizado');
      setEditOpen(false);
      loadUsers();
    } else {
      toast.error('Error al actualizar', { description: error ?? '' });
    }
    setSaving(false);
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
    setDeleteOpen(true);
  };

  const handleFinalDelete = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    const { data, error } = await deleteUser(accessToken, userToDelete.id);
    if (error) {
      toast.error('Error al suspender usuario', { description: error });
    } else {
      toast.success(`${userToDelete.name || userToDelete.id} ha sido suspendido`);
      setDeleteConfirm(false);
      setUserToDelete(null);
      loadUsers();
    }
    setDeleting(false);
  };

  const handleCreateUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    setCreating(true);
    const { data, error } = await createUser(accessToken, {
      name: newName.trim(), email: newEmail.trim(),
      password: newPassword, role: newRole, status: newStatus,
    });
    if (data) {
      toast.success('Usuario creado correctamente', {
        description: 'Puede que necesite confirmar su email según la configuración de Supabase.',
      });
      setCreateOpen(false);
      setNewName(''); setNewEmail(''); setNewPassword('');
      setNewRole('citizen'); setNewStatus('active');
      loadUsers();
    } else {
      toast.error('Error al crear usuario', { description: error ?? '' });
    }
    setCreating(false);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Gestión de Usuarios y Roles
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{filteredUsers.length} usuarios</Badge>
              <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setCreateOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Crear Usuario
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="auditor">Auditor</SelectItem>
                <SelectItem value="citizen">Ciudadano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="suspended">Suspendido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha Alta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user, idx) => (
                    <TableRow key={user.id ?? `u-${idx}`}>
                      <TableCell className="font-medium">
                        {/* full_name normalizado como 'name' en el servicio */}
                        {user.name || user.full_name || <span className="text-gray-400 italic">Sin nombre</span>}
                        <p className="text-xs text-gray-400 font-mono">{user.id?.slice(0, 8)}…</p>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{user.phone ?? '—'}</TableCell>
                      <TableCell><RoleBadge role={user.role ?? 'citizen'} /></TableCell>
                      <TableCell><StatusBadge status={user.status ?? 'active'} /></TableCell>
                      <TableCell className="text-sm">{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        {user.id !== currentUserId && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} title="Suspender" className="text-red-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState icon={Users} title="Sin usuarios" description="No se encontraron usuarios con los filtros aplicados" />
          )}
        </CardContent>
      </Card>

      {/* Editar usuario */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modificar rol y estado de {selectedUser?.name || selectedUser?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-role">Rol</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="citizen">Ciudadano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-status">Estado</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger id="edit-status" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Primera confirmación de suspensión */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspender Usuario</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas suspender a <strong>{userToDelete?.name || userToDelete?.id}</strong>?
              El usuario no podrá iniciar sesión mientras esté suspendido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDeleteOpen(false); setDeleteConfirm(true); }}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Segunda confirmación */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <AlertDialogTitle>Confirmación Final</AlertDialogTitle>
                <p className="text-sm text-gray-500 mt-0.5">Esta acción quedará registrada en auditoría</p>
              </div>
            </div>
            <AlertDialogDescription>
              El usuario <strong className="text-red-600">{userToDelete?.name || userToDelete?.id}</strong> quedará
              suspendido inmediatamente. Su perfil y datos permanecen en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 my-2">
            <strong>ID:</strong> {userToDelete?.id}<br />
            <strong>Rol actual:</strong> {userToDelete?.role ?? 'N/A'}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirm(false); setUserToDelete(null); }} disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <Button onClick={handleFinalDelete} disabled={deleting} variant="destructive">
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Suspendiendo...</> : 'Sí, Suspender'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Crear usuario */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Usuario</DialogTitle>
            <DialogDescription>
              El usuario recibirá un email de confirmación según la configuración de Supabase Auth.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-name">Nombre completo *</Label>
              <Input id="new-name" placeholder="Nombre completo" value={newName} onChange={e => setNewName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="new-email">Correo electrónico *</Label>
              <Input id="new-email" type="email" placeholder="correo@ejemplo.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="new-password">Contraseña *</Label>
              <Input id="new-password" type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="new-role">Rol</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="auditor">Auditor</SelectItem>
                  <SelectItem value="citizen">Ciudadano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-status">Estado inicial</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="new-status" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando...</> : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
