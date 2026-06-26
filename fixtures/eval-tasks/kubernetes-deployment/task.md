# Kubernetes Stateful Application Task

You need to write a Kubernetes manifest in `mysql-stateful.yaml` that defines all the resources needed to run a single-instance stateful MySQL application.

Requirements:
- Create a `PersistentVolume` named `mysql-pv-volume` (20Gi storage capacity, ReadWriteOnce access mode, hostPath `/mnt/data`, storageClassName manual).
- Create a `PersistentVolumeClaim` named `mysql-pv-claim` (requesting 20Gi storage, storageClassName manual, ReadWriteOnce access mode).
- Create a headless `Service` named `mysql` exposing port `3306` with `clusterIP: None` mapping to selector `app: mysql`.
- Create a `Deployment` named `mysql` that runs image `mysql:9`, sets `MYSQL_ROOT_PASSWORD` environment variable, exposes containerPort `3306`, and mounts a volume named `mysql-persistent-storage` at `/var/lib/mysql` using the PersistentVolumeClaim `mysql-pv-claim`.

Put all these resources in the same `mysql-stateful.yaml` file, separated by `---` lines.

Run `npm test` to verify your implementation.
