"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthProvider";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { UserService } from "@/lib/services/userService";
import { UserListItem, UserVisit } from "@/types/user";
import {
  DateSelector,
  UserRow,
  UsersListHeader,
  UsersTableHeader,
  UserHistoryPagination,
  EmptyStates,
  UserDetailsModal,
} from "@/components/user-history";

export default function UserHistoryPage() {
  const { token, logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [tempDate, setTempDate] = useState<Date | undefined>(new Date());
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserListItem[]>([]);
  const [searchName, setSearchName] = useState("");
  const [loading, setLoading] = useState(false);
  const initialLoadRef = useRef(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Modal state for user details
  const [selectedUser, setSelectedUser] = useState<UserVisit | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<number | null>(null);

  const handleSearch = useCallback(async () => {
    if (!token || !tempDate) return;

    setLoading(true);
    setCurrentPage(1);
    setSelectedDate(tempDate);
    setSearchName("");

    try {
      const istDate = new Date(
        tempDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      );
      const year = istDate.getFullYear();
      const month = String(istDate.getMonth() + 1).padStart(2, "0");
      const day = String(istDate.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;

      const users = await UserService.fetchUsersList(dateString);
      setUsersList(users);
      setFilteredUsers(users);
    } catch {
      setUsersList([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, tempDate]);

  // Filter users by name
  useEffect(() => {
    if (!searchName.trim()) {
      setFilteredUsers(usersList);
      setCurrentPage(1);
      return;
    }

    const filtered = usersList.filter((user) =>
      user.name.toLowerCase().includes(searchName.toLowerCase()),
    );
    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [searchName, usersList]);

  // Clamp currentPage when filteredUsers changes
  const filteredUsersLength = filteredUsers.length;
  useEffect(() => {
    const maxPages = Math.max(1, Math.ceil(filteredUsersLength / itemsPerPage));
    setCurrentPage((prev) => Math.min(prev, maxPages));
  }, [filteredUsersLength, itemsPerPage]);

  // Initial load
  useEffect(() => {
    if (token && !initialLoadRef.current) {
      initialLoadRef.current = true;
      handleSearch();
    }
  }, [token, handleSearch]);

  // Pagination calculations
  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / itemsPerPage),
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  const goToPage = useCallback(
    (page: number) => {
      const newPage = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(newPage);
    },
    [totalPages],
  );

  const handleUserClick = useCallback(
    async (user: UserListItem) => {
      if (!token || !selectedDate) return;

      setLoadingUserId(user.uid);
      setLoadingDetails(true);

      const delay = Math.floor(Math.random() * 2000) + 1000;

      try {
        await new Promise((resolve) => setTimeout(resolve, delay));

        const istDate = new Date(
          selectedDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
        );
        const year = istDate.getFullYear();
        const month = String(istDate.getMonth() + 1).padStart(2, "0");
        const day = String(istDate.getDate()).padStart(2, "0");
        const dateString = `${year}-${month}-${day}`;

        const userDetails = await UserService.fetchUserDetails(
          dateString,
          user.uid,
        );
        setSelectedUser(userDetails);
      } catch {
        setSelectedUser(null);
      } finally {
        setLoadingDetails(false);
        setLoadingUserId(null);
      }
    },
    [token, selectedDate],
  );

  const closeModal = useCallback(() => {
    setSelectedUser(null);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchName("");
  }, []);

  const showEmptyState =
    loading || usersList.length === 0 || filteredUsers.length === 0;

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader title="User History" />

      <div className="p-4 sm:p-6">
        <DateSelector
          tempDate={tempDate}
          onTempDateChange={setTempDate}
          loading={loading}
          onSearch={handleSearch}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
        >
          <UsersListHeader
            selectedDate={selectedDate}
            filteredCount={filteredUsers.length}
            totalCount={usersList.length}
            searchName={searchName}
            onSearchChange={setSearchName}
          />

          {showEmptyState ? (
            <EmptyStates
              loading={loading}
              hasUsers={usersList.length > 0}
              hasFilteredUsers={filteredUsers.length > 0}
              searchName={searchName}
              onClearSearch={clearSearch}
            />
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[990px] px-4">
                  <UsersTableHeader />
                  <div>
                    {currentUsers.map((user, index) => (
                      <UserRow
                        key={`${user.uid}-${user.timestamp}`}
                        user={user}
                        index={index}
                        startIndex={startIndex}
                        loadingUserId={loadingUserId}
                        onUserClick={handleUserClick}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <UserHistoryPagination
                currentPage={currentPage}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                filteredCount={filteredUsers.length}
                totalCount={usersList.length}
                searchName={searchName}
                onPageChange={goToPage}
              />
            </>
          )}
        </motion.div>

        <UserDetailsModal
          user={selectedUser}
          loading={loadingDetails}
          onClose={closeModal}
        />
      </div>
    </AdminLayout>
  );
}
