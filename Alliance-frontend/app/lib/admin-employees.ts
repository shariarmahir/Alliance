import "server-only";
import { readBlobJson, writeBlobJson } from "./blob-store";
import type { Employee, Task, LeaveRequest, DailyReport, TaskStatus, LeaveStatus } from "./types";

// Server-only read/write layer for Phase 4 (employees, tasks, leave requests,
// daily reports) — mirrors app/lib/admin-operations.ts's pattern.
//
// Always reads fresh via Blob per call (no module-level caching), same as
// admin-operations.ts.

async function readJsonFile<T>(filename: string): Promise<T> {
  return readBlobJson<T>(filename);
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await writeBlobJson(filename, data);
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export async function readEmployees(): Promise<Employee[]> {
  return readJsonFile<Employee[]>("employees.json");
}

export async function writeEmployees(employees: Employee[]): Promise<void> {
  await writeJsonFile("employees.json", employees);
}

export async function addEmployee(employee: Employee): Promise<void> {
  const employees = await readEmployees();
  employees.push(employee);
  await writeEmployees(employees);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function readTasks(): Promise<Task[]> {
  return readJsonFile<Task[]>("tasks.json");
}

export async function writeTasks(tasks: Task[]): Promise<void> {
  await writeJsonFile("tasks.json", tasks);
}

export async function addTask(task: Task): Promise<void> {
  const tasks = await readTasks();
  tasks.push(task);
  await writeTasks(tasks);
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const tasks = await readTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Task not found: ${id}`);
  task.status = status;
  await writeTasks(tasks);
  return task;
}

// ---------------------------------------------------------------------------
// Leave requests
// ---------------------------------------------------------------------------

export async function readLeaveRequests(): Promise<LeaveRequest[]> {
  return readJsonFile<LeaveRequest[]>("leave-requests.json");
}

export async function writeLeaveRequests(requests: LeaveRequest[]): Promise<void> {
  await writeJsonFile("leave-requests.json", requests);
}

export async function addLeaveRequest(request: LeaveRequest): Promise<void> {
  const requests = await readLeaveRequests();
  requests.push(request);
  await writeLeaveRequests(requests);
}

export async function updateLeaveStatus(id: string, status: LeaveStatus): Promise<LeaveRequest> {
  const requests = await readLeaveRequests();
  const request = requests.find((r) => r.id === id);
  if (!request) throw new Error(`Leave request not found: ${id}`);
  request.status = status;
  await writeLeaveRequests(requests);
  return request;
}

// ---------------------------------------------------------------------------
// Daily reports
// ---------------------------------------------------------------------------

export async function readDailyReports(): Promise<DailyReport[]> {
  return readJsonFile<DailyReport[]>("daily-reports.json");
}

export async function writeDailyReports(reports: DailyReport[]): Promise<void> {
  await writeJsonFile("daily-reports.json", reports);
}

export async function addDailyReport(report: DailyReport): Promise<void> {
  const reports = await readDailyReports();
  reports.push(report);
  await writeDailyReports(reports);
}
