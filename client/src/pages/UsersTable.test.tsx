import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { Role } from "core/constants/role.ts";
import { renderWithQuery } from "@/test/render";
import UsersTable from "./UsersTable";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const mockUsers = [
  {
    id: "user-1",
    name: "John Admin",
    email: "john@example.com",
    role: Role.admin,
    createdAt: "2025-01-10T12:00:00.000Z",
  },
  {
    id: "user-2",
    name: "Jane Agent",
    email: "jane@example.com",
    role: Role.agent,
    createdAt: "2025-02-15T15:30:00.000Z",
  },
];

describe("UsersTable Component", () => {
  const onEditMock = vi.fn();
  const onDeleteMock = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should render table headers correctly", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    expect(screen.getByRole("columnheader", { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^email$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^role$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^created$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^actions$/i })).toBeInTheDocument();
  });

  it("should display skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    expect(document.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
  });

  it("should render list of users with name, email, role badge, and formatted date", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: mockUsers } });
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    await waitFor(() => {
      expect(screen.getByText("John Admin")).toBeInTheDocument();
    });

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("Jane Agent")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();

    const expectedDate1 = new Date("2025-01-10T12:00:00.000Z").toLocaleDateString();
    const expectedDate2 = new Date("2025-02-15T15:30:00.000Z").toLocaleDateString();
    expect(screen.getByText(expectedDate1)).toBeInTheDocument();
    expect(screen.getByText(expectedDate2)).toBeInTheDocument();
  });

  it("should show error alert when fetching users fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network Error"));
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch users")).toBeInTheDocument();
    });
  });

  it("should call onEdit when clicking the edit button", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: mockUsers } });
    const user = userEvent.setup();
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    await waitFor(() => {
      expect(screen.getByText("John Admin")).toBeInTheDocument();
    });

    const editBtn = screen.getByRole("button", { name: "Edit John Admin" });
    await user.click(editBtn);

    expect(onEditMock).toHaveBeenCalledTimes(1);
    expect(onEditMock).toHaveBeenCalledWith(mockUsers[0]);
  });

  it("should call onDelete when clicking delete button on an agent row", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: mockUsers } });
    const user = userEvent.setup();
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    await waitFor(() => {
      expect(screen.getByText("Jane Agent")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete Jane Agent" });
    await user.click(deleteBtn);

    expect(onDeleteMock).toHaveBeenCalledTimes(1);
    expect(onDeleteMock).toHaveBeenCalledWith(mockUsers[1]);
  });

  it("should not render delete button for admin user", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: mockUsers } });
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    await waitFor(() => {
      expect(screen.getByText("John Admin")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Delete John Admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Jane Agent" })).toBeInTheDocument();
  });

  it("should render empty table when there are no users", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: [] } });
    renderWithQuery(<UsersTable onEdit={onEditMock} onDelete={onDeleteMock} />);

    await waitFor(() => {
      expect(document.querySelector("[data-slot='skeleton']")).not.toBeInTheDocument();
    });

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(1); // header only
  });
});
